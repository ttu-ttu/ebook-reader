/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BehaviorSubject } from 'rxjs';
import { supabase } from '$lib/data/supabase/client';
import {
  abrirDicionario,
  apagarDicionario,
  consultar,
  NOME_BANCO,
  versaoGravada,
  type BancoDicionario
} from './banco';
import { baixarArquivo, lerDicionarioAtual, prepararArquivo, type DicionarioAtual } from './baixar';
import type { Consulta } from './busca';
import type { Entrada } from './formato';
import { CACHE_TOKENIZADOR, carregarTokenizador, type Tokenizador } from './tokenizador';

// O dicionário no app (ADR 0004): baixado do bucket `dicts` no primeiro toque, com aviso de
// tamanho, e gravado no IndexedDB; o tokenizador num cache próprio (ADR 0012).

export type EstadoDicionario =
  | { tipo: 'verificando' }
  | { tipo: 'ausente' }
  | { tipo: 'baixando'; bytes: number; total: number }
  | { tipo: 'preparando'; fracao: number }
  | { tipo: 'pronto'; versao: string; baixadoEm?: number }
  | { tipo: 'erro'; mensagem: string };

export const estadoDicionario$ = new BehaviorSubject<EstadoDicionario>({ tipo: 'verificando' });

/** O wasm do lindera (R3: 18,0 MB, 16,5 MB em gzip). */
export const TAMANHO_TOKENIZADOR = 18_000_000;

const CHAVE_BAIXADO_EM = 'dokusho-dicionario-baixado-em';
const CONSULTAS_NA_MEMORIA = 500;

let banco: Promise<BancoDicionario> | undefined;
let carregando: Promise<Tokenizador> | undefined;
let baixando: Promise<void> | undefined;

const consultas = new Map<string, Promise<Entrada[]>>();

function abrir() {
  if (!banco) banco = abrirDicionario();
  return banco;
}

function lerBaixadoEm() {
  try {
    return Number(localStorage.getItem(CHAVE_BAIXADO_EM)) || undefined;
  } catch {
    return undefined;
  }
}

/** Vê se o dicionário está gravado neste aparelho (não usa a rede). */
export async function verificarDicionario() {
  try {
    const versao = await versaoGravada(await abrir());

    estadoDicionario$.next(
      versao ? { tipo: 'pronto', versao, baixadoEm: lerBaixadoEm() } : { tipo: 'ausente' }
    );

    return !!versao;
  } catch (erro) {
    estadoDicionario$.next({ tipo: 'erro', mensagem: mensagemDe(erro) });

    return false;
  }
}

export async function tokenizadorEmCache() {
  try {
    const cache = await caches.open(CACHE_TOKENIZADOR);

    return (await cache.keys()).length > 0;
  } catch {
    return false;
  }
}

/** O que há no bucket e quanto falta baixar neste aparelho (para o aviso de tamanho). */
export async function infoDoDownload(): Promise<{ atual: DicionarioAtual; bytes: number }> {
  const atual = await lerDicionarioAtual(supabase);
  const bytes = atual.bytes + ((await tokenizadorEmCache()) ? 0 : TAMANHO_TOKENIZADOR);

  return { atual, bytes };
}

/** Versão nova no bucket (ou dicionário ausente aqui). */
export async function haVersaoNova() {
  const { atual } = await infoDoDownload();

  return (await versaoGravada(await abrir())) !== atual.versao;
}

/** Baixa e grava o dicionário do bucket, e deixa o tokenizador no cache. */
export function baixarDicionario() {
  if (!baixando) {
    baixando = (async () => {
      try {
        const db = await abrir();
        const atual = await lerDicionarioAtual(supabase);

        if ((await versaoGravada(db)) !== atual.versao) {
          estadoDicionario$.next({ tipo: 'baixando', bytes: 0, total: atual.bytes });

          const arquivo = await baixarArquivo(supabase, atual, (bytes, total) =>
            estadoDicionario$.next({ tipo: 'baixando', bytes, total })
          );

          estadoDicionario$.next({ tipo: 'preparando', fracao: 0 });
          await prepararArquivo(db, arquivo, (fracao) =>
            estadoDicionario$.next({ tipo: 'preparando', fracao })
          );
          consultas.clear();

          try {
            localStorage.setItem(CHAVE_BAIXADO_EM, String(Date.now()));
          } catch {
            // Sem localStorage, só a data some das configurações.
          }
        }

        await tokenizador();
        await verificarDicionario();
      } catch (erro) {
        estadoDicionario$.next({ tipo: 'erro', mensagem: mensagemDe(erro) });
        throw erro;
      } finally {
        baixando = undefined;
      }
    })();
  }

  return baixando;
}

export async function apagarDicionarioLocal() {
  const db = await banco;

  db?.close();
  banco = undefined;
  consultas.clear();
  await apagarDicionario(NOME_BANCO);

  try {
    localStorage.removeItem(CHAVE_BAIXADO_EM);
  } catch {
    // Nada a limpar.
  }

  estadoDicionario$.next({ tipo: 'ausente' });
}

/** O tokenizador, carregado uma vez por sessão (do cache próprio ou da rede). */
export function tokenizador() {
  if (!carregando) {
    carregando = carregarTokenizador()
      .then(({ tokenizador: carregado }) => carregado)
      .catch((erro) => {
        carregando = undefined;
        throw erro;
      });
  }

  return carregando;
}

/** Consulta ao dicionário gravado, com as últimas respostas na memória. */
export const consultarPalavra: Consulta = (termo) => {
  let resposta = consultas.get(termo);

  if (!resposta) {
    resposta = abrir().then((db) => consultar(db, termo));
    consultas.set(termo, resposta);

    if (consultas.size > CONSULTAS_NA_MEMORIA) {
      consultas.delete(consultas.keys().next().value as string);
    }
  }

  return resposta;
};

const AMOSTRA =
  '彼はふと気がついた。立ち止まった少女は、振り返らなかった。「わかってるよ」と言いながら、彼は笑っていた。' +
  '食べさせられたくなかったのに、何も知らずに帰ってしまった。話しかけられても返事をしなかったらしい。' +
  '読み終わったら貸してあげると約束したが、静かな夜だったので、窓の外を眺めながら考え込んでいた。';

/**
 * Mede a busca do toque (seleção híbrida) em cada pedaço de uma amostra, contra a meta de 100 ms
 * por consulta (ADR 0004). Começa com a memória de consultas vazia, como depois de abrir o app.
 */
export async function medirConsultas() {
  const { selecionar } = await import('./busca');
  const inicioTokenizador = performance.now();
  const tk = await tokenizador();
  const tempoTokenizador = performance.now() - inicioTokenizador;
  const pedacos = tk.tokenizar(AMOSTRA);
  const tempos: number[] = [];

  let achados = 0;

  consultas.clear();

  for (const pedaco of pedacos) {
    const inicio = performance.now();
    const selecao = await selecionar(consultarPalavra, pedacos, pedaco.inicio);

    if (!selecao) continue;

    tempos.push(performance.now() - inicio);
    if (selecao.entradas.length) achados += 1;
  }

  tempos.sort((a, b) => a - b);

  return {
    toques: tempos.length,
    achados,
    media: tempos.reduce((soma, t) => soma + t, 0) / (tempos.length || 1),
    p95: tempos[Math.floor(tempos.length * 0.95)] ?? 0,
    maximo: tempos.at(-1) ?? 0,
    tempoTokenizador
  };
}

function mensagemDe(erro: unknown) {
  return erro instanceof Error ? erro.message : String(erro);
}

export function formatarMb(bytes: number) {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

/** Data da versão: o script grava `jmdict-<aaaa-mm-dd>-f<formato>`. */
export function dataDaVersao(versao: string) {
  return versao.match(/\d{4}-\d{2}-\d{2}/)?.[0];
}
