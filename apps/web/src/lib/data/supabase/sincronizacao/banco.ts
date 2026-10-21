/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AlcanceLocal, LinhaEstatistica, LinhaMarcador } from './regras';

// Banco próprio da sincronização, ao lado do books-db do ttu (ADR 0014).

export interface LivroSinc {
  /** Hash do EPUB (ADR 0001); para livros que chegaram sem o EPUB, hash do texto processado. */
  id: string;
  titulo: string;
  /** EPUB original guardado até subir para o bucket. */
  original?: Blob;
  temOriginal?: boolean;
  /** O que falta subir. */
  pendente: { original?: true; processado?: true; capa?: true; linha?: true };
  /** modified_at da linha de books (horário do aparelho que importou). */
  modificado: number;
  /** Apagado neste aparelho; falta avisar o servidor. */
  apagadoEm?: number;
  tamanho?: number;
}

interface SincDb extends DBSchema {
  livros: { key: string; value: LivroSinc; indexes: { titulo: string } };
  /** `<tabela>|<chave>` → modified_at (ms) do que já está no servidor. */
  enviados: { key: string; value: number };
  /** Tabela → maior updated_at recebido. */
  cursores: { key: string; value: string };
  /** Estatísticas dos outros aparelhos; as deste ficam no books-db do ttu. */
  estatisticasOutras: {
    key: [string, string, string];
    value: LinhaEstatistica;
    indexes: { date_key: string };
  };
  /** Marcador mais novo de outro aparelho, para perguntar ao abrir o livro. */
  marcadoresRemotos: { key: string; value: LinhaMarcador };
  alcances: { key: string; value: AlcanceLocal };
}

export type BancoSinc = IDBPDatabase<SincDb>;

export const NOME_BANCO_SINC = 'dokusho-sinc';

export function abrirBancoSinc(nome = NOME_BANCO_SINC) {
  return openDB<SincDb>(nome, 1, {
    upgrade(db) {
      db.createObjectStore('livros', { keyPath: 'id' }).createIndex('titulo', 'titulo');
      db.createObjectStore('enviados');
      db.createObjectStore('cursores');
      db.createObjectStore('estatisticasOutras', {
        keyPath: ['book_id', 'date_key', 'device_id']
      }).createIndex('date_key', 'date_key');
      db.createObjectStore('marcadoresRemotos');
      db.createObjectStore('alcances');
    }
  });
}
