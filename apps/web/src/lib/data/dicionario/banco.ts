/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  chaveDoBloco,
  FORMATO,
  lerLinha,
  TAMANHO_BLOCO,
  type BlocoIndice,
  type Cabecalho,
  type Entrada
} from './formato';

// Banco próprio, separado do books-db do ttu: o dicionário é trocado inteiro a cada versão.
interface DicionarioDb extends DBSchema {
  entradas: { key: number; value: Entrada[] };
  indice: { key: string; value: BlocoIndice };
  meta: { key: 'cabecalho'; value: Cabecalho };
}

export type BancoDicionario = IDBPDatabase<DicionarioDb>;

export const NOME_BANCO = 'dokusho-dicionario';
const POR_TRANSACAO = 500;

export function abrirDicionario(nome = NOME_BANCO) {
  return openDB<DicionarioDb>(nome, 1, {
    upgrade(db) {
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
      const registro = lerLinha(linha);
      if (registro[0] === 'e') tx.objectStore('entradas').put(registro[2], registro[1]);
      else tx.objectStore('indice').put(registro[2], registro[1]);
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
      total = cabecalho.blocos + cabecalho.chaves;
      continue;
    }
    lote.push(linha);
    if (lote.length >= POR_TRANSACAO) await gravarLote();
  }
  if (!cabecalho) throw new Error('Arquivo do dicionário vazio');
  if (lote.length) await gravarLote();
  await db.put('meta', cabecalho, 'cabecalho');
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
  const ids = (await db.get('indice', chaveDoBloco(termo)))?.[termo];
  if (!ids?.length) return [];
  const blocos = new Map<number, Entrada[]>();
  const tx = db.transaction('entradas');
  await Promise.all(
    [...new Set(ids.map((id) => Math.floor(id / TAMANHO_BLOCO)))].map(async (bloco) => {
      blocos.set(bloco, (await tx.store.get(bloco)) ?? []);
    })
  );
  const entradas = ids
    .map((id) => blocos.get(Math.floor(id / TAMANHO_BLOCO))?.[id % TAMANHO_BLOCO])
    .filter((e): e is Entrada => !!e);
  return entradas
    .map((entrada, ordem) => ({ entrada, ordem, f: frequencia(entrada, termo) }))
    .sort((a, b) => a.f - b.f || a.ordem - b.ordem)
    .map(({ entrada }) => entrada);
}
