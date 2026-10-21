/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { database } from '$lib/data/store';
import { sincronizador } from '$lib/data/supabase/sincronizacao/iniciar';
import type { LinhaDeLeitura } from './inicio';

// As linhas de leitura para a tela Início: as deste aparelho (banco do ttu) e as dos outros
// aparelhos (recebidas pela sincronização, ADR 0014). A tela soma.

export const LIVRO_APAGADO = 'Livro apagado';

export async function linhasDeLeitura(): Promise<LinhaDeLeitura[]> {
  const db = await database.db;
  const locais = (await db.getAll('statistic')).map((linha) => ({
    livro: linha.title,
    dia: linha.dateKey,
    tempo: linha.readingTime,
    caracteres: linha.charactersRead
  }));
  const titulos = await sincronizador().titulosDosLivros();
  const outras = (await sincronizador().estatisticasDeOutrosAparelhos()).map((linha) => ({
    livro: titulos.get(linha.book_id) ?? LIVRO_APAGADO,
    dia: linha.date_key,
    tempo: linha.reading_time,
    caracteres: linha.characters_read
  }));

  return [...locais, ...outras];
}

/** Capas dos livros (do banco do ttu), por título. */
export async function capasDosLivros() {
  const db = await database.db;
  const capas = new Map<string, string>();

  for (const livro of await db.getAll('data')) {
    if (livro.coverImage instanceof Blob)
      capas.set(livro.title, URL.createObjectURL(livro.coverImage));
  }

  return capas;
}
