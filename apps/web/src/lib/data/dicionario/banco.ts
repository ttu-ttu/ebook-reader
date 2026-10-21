/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  blocoDoTermo,
  FORMATO,
  separarLinha,
  TAMANHO_BLOCO,
  type BlocoIndice,
  type Cabecalho,
  type Entrada
} from './formato';

// Banco próprio, separado do books-db do ttu: o dicionário é trocado inteiro a cada versão.
// Os blocos ficam como texto JSON (Entrada[] e BlocoIndice): gravar texto é bem mais rápido que
// ler e gravar objetos, e a consulta só lê os blocos de que precisa.
interface DicionarioDb extends DBSchema {
  entradas: { key: number; value: string };
  indice: { key: number; value: string };
  meta: { key: 'cabecalho'; value: Cabecalho };
}

export type BancoDicionario = IDBPDatabase<DicionarioDb>;

export const NOME_BANCO = 'dokusho-dicionario';
const POR_TRANSACAO = 500;
const cabecalhos = new WeakMap<BancoDicionario, Cabecalho>();

// Blocos já lidos ficam na memória: a seleção do toque consulta vários trechos em seguida, quase
// sempre nos mesmos blocos (R3: ler e fazer o parse de um bloco custa alguns ms no iPhone).
const BLOCOS_NA_MEMORIA = 64;
const memorias = new WeakMap<
  BancoDicionario,
  { indice: Map<number, BlocoIndice>; entradas: Map<number, Entrada[]> }
>();

function memoriaDe(db: BancoDicionario) {
  let memoria = memorias.get(db);
  if (!memoria) {
    memoria = { indice: new Map(), entradas: new Map() };
    memorias.set(db, memoria);
  }
  return memoria;
}

function lembrar<T>(mapa: Map<number, T>, chave: number, valor: T) {
  mapa.set(chave, valor);
  if (mapa.size > BLOCOS_NA_MEMORIA) mapa.delete(mapa.keys().next().value as number);
}

export function abrirDicionario(nome = NOME_BANCO) {
  return openDB<DicionarioDb>(nome, 3, {
    upgrade(db) {
      for (const store of [...db.objectStoreNames]) db.deleteObjectStore(store);
      db.createObjectStore('entradas');
      db.createObjectStore('indice');
      db.createObjectStore('meta');
    }
  });
}

export async function apagarDicionario(nome = NOME_BANCO) {
  await new Promise<void>((ok, erro) => {
    const pedido = indexedDB.deleteDatabase(nome);
    pedido.onsuccess = () => ok();
    pedido.onerror = () => erro(pedido.error);
  });
}

export async function versaoGravada(db: BancoDicionario) {
  return (await db.get('meta', 'cabecalho'))?.versao;
}

/**
 * Grava o arquivo do dicionário (linhas de formato.ts). A versão só é marcada no fim, então
 * uma gravação interrompida (o iOS pausa a PWA) fica sem versão e recomeça do zero.
 */
export async function gravarDicionario(
  db: BancoDicionario,
  linhas: AsyncIterable<string>,
  aoProgredir?: (fracao: number) => void
) {
  cabecalhos.delete(db);
  memorias.delete(db);
  await db.clear('meta');
  await db.clear('entradas');
  await db.clear('indice');

  let cabecalho: Cabecalho | undefined;
  let total = 0;
  let feitos = 0;
  let lote: string[] = [];

  const gravarLote = async () => {
    const tx = db.transaction(['entradas', 'indice'], 'readwrite');
    for (const linha of lote) {
      const { tipo, bloco, json } = separarLinha(linha);
      tx.objectStore(tipo === 'e' ? 'entradas' : 'indice').put(json, bloco);
    }
    await tx.done;
    feitos += lote.length;
    lote = [];
    aoProgredir?.(Math.min(feitos / total, 0.99));
  };

  for await (const linha of linhas) {
    if (!linha) continue;
    if (!cabecalho) {
      cabecalho = JSON.parse(linha) as Cabecalho;
      if (cabecalho.formato !== FORMATO)
        throw new Error(`Formato ${cabecalho.formato} desconhecido`);
      total = cabecalho.blocos + cabecalho.limitesIndice.length;
      continue;
    }
    lote.push(linha);
    if (lote.length >= POR_TRANSACAO) await gravarLote();
  }
  if (!cabecalho) throw new Error('Arquivo do dicionário vazio');
  if (lote.length) await gravarLote();
  await db.put('meta', cabecalho, 'cabecalho');
  cabecalhos.set(db, cabecalho);
  aoProgredir?.(1);
  return cabecalho;
}

/** Posição JPDB da forma mais frequente da entrada que bate com o termo. */
function frequencia(entrada: Entrada, termo: string) {
  let melhor = Infinity;
  for (const forma of entrada.formas) {
    if (forma.e === termo && forma.f !== undefined) melhor = Math.min(melhor, forma.f);
    if (forma.l === termo && forma.fk !== undefined) melhor = Math.min(melhor, forma.fk);
  }
  return melhor;
}

/** Entradas cuja escrita ou leitura é exatamente o termo, da mais frequente para a menos. */
export async function consultar(db: BancoDicionario, termo: string): Promise<Entrada[]> {
  let cabecalho = cabecalhos.get(db);
  if (!cabecalho) {
    cabecalho = await db.get('meta', 'cabecalho');
    if (!cabecalho) return [];
    cabecalhos.set(db, cabecalho);
  }
  const bloco = blocoDoTermo(cabecalho.limitesIndice, termo);
  if (bloco < 0) return [];
  const memoria = memoriaDe(db);
  let blocoIndice = memoria.indice.get(bloco);
  if (!blocoIndice) {
    const json = await db.get('indice', bloco);
    blocoIndice = json ? (JSON.parse(json) as BlocoIndice) : {};
    lembrar(memoria.indice, bloco, blocoIndice);
  }
  const ids = blocoIndice[termo];
  if (!ids?.length) return [];
  const blocos = new Map<number, Entrada[]>();
  const tx = db.transaction('entradas');
  await Promise.all(
    [...new Set(ids.map((id) => Math.floor(id / TAMANHO_BLOCO)))].map(async (bloco) => {
      let entradas = memoria.entradas.get(bloco);
      if (!entradas) {
        const json = await tx.store.get(bloco);
        entradas = json ? (JSON.parse(json) as Entrada[]) : [];
        lembrar(memoria.entradas, bloco, entradas);
      }
      blocos.set(bloco, entradas);
    })
  );
  const entradas = ids
    .map((id) => blocos.get(Math.floor(id / TAMANHO_BLOCO))?.[id % TAMANHO_BLOCO])
    .filter((e): e is Entrada => !!e);
  return ordenarPorFrequencia(entradas, termo);
}

/** Da entrada mais frequente para a menos, pela forma que bate com o termo (estável). */
export function ordenarPorFrequencia(entradas: Entrada[], termo: string) {
  return entradas
    .map((entrada, ordem) => ({ entrada, ordem, f: frequencia(entrada, termo) }))
    .sort((a, b) => a.f - b.f || a.ordem - b.ordem)
    .map(({ entrada }) => entrada);
}
