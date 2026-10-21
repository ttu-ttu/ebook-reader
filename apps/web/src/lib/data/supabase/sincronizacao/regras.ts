/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookmarkData,
  BooksDbReadingGoal,
  BooksDbStatistic
} from '$lib/data/database/books-db/versions/books-db';
import type { Database } from '$lib/data/supabase/database.types';

// Conversões entre o IndexedDB do ttu e as linhas do Supabase, e a regra da última escrita
// (ADR 0002): vale o horário do aparelho (modified_at), nunca o updated_at do servidor.

type Tabelas = Database['public']['Tables'];
export type LinhaLivro = Tabelas['books']['Row'];
export type LinhaMarcador = Tabelas['bookmarks']['Row'];
export type LinhaEstatistica = Tabelas['reading_stats']['Row'];
export type LinhaMeta = Tabelas['reading_goals']['Row'];

export type NovaLinhaLivro = Tabelas['books']['Insert'];
export type NovaLinhaMarcador = Tabelas['bookmarks']['Insert'];
export type NovaLinhaEstatistica = Tabelas['reading_stats']['Insert'];
export type NovaLinhaMeta = Tabelas['reading_goals']['Insert'];

export interface Aparelho {
  id: string;
  nome: string;
}

export function paraIso(ms: number) {
  return new Date(ms).toISOString();
}

export function deIso(iso: string | null | undefined) {
  return iso ? Date.parse(iso) : 0;
}

/** A linha do servidor vence a local quando foi modificada depois (no relógio de quem agiu). */
export function remotoVence(localMs: number | undefined, remotoModifiedAt: string) {
  return !localMs || deIso(remotoModifiedAt) > localMs;
}

/** Já enviada quando o que foi enviado tem o mesmo horário (ou mais novo) que o local. */
export function precisaEnviar(localMs: number, enviadoMs: number | undefined) {
  return !enviadoMs || localMs > enviadoMs;
}

/** O Alcance nunca volta pela leitura; só um "desmarcar" (V1.3) grava um valor menor. */
export function alcancePelaLeitura(alcance: number | undefined, explorado: number | undefined) {
  return Math.max(alcance || 0, explorado || 0);
}

export interface AlcanceLocal {
  valor: number;
  /** Horário do último "desmarcar a partir daqui", que baixa o Alcance de propósito. */
  baixadoEm?: number;
}

/**
 * Alcance depois de receber o marcador de outro aparelho. Se a linha do servidor vence, vale o
 * Alcance dela (pode ser um "desmarcar" feito lá). Se não vence, fica o maior dos dois, a não ser
 * que um "desmarcar" daqui seja mais novo que a linha.
 */
export function alcanceRecebido(
  local: AlcanceLocal | undefined,
  marcadorLocalMs: number | undefined,
  linha: Pick<LinhaMarcador, 'reach_char_count' | 'modified_at'>
): AlcanceLocal {
  const remoto = linha.reach_char_count || 0;

  if (remotoVence(marcadorLocalMs, linha.modified_at)) {
    return { valor: remoto };
  }

  if (!local) {
    return { valor: remoto };
  }

  if (local.baixadoEm && local.baixadoEm >= deIso(linha.modified_at)) {
    return local;
  }

  return { ...local, valor: Math.max(local.valor, remoto) };
}

export function marcadorParaLinha(
  livroId: string,
  marcador: BooksDbBookmarkData,
  alcance: number,
  aparelho: Aparelho
): NovaLinhaMarcador {
  return {
    book_id: livroId,
    progress: marcador.progress === undefined ? null : String(marcador.progress),
    scroll_x: marcador.scrollX ?? null,
    scroll_y: marcador.scrollY ?? null,
    explored_char_count: marcador.exploredCharCount ?? null,
    reach_char_count: alcance,
    device_id: aparelho.id,
    device_name: aparelho.nome,
    modified_at: paraIso(marcador.lastBookmarkModified),
    deleted_at: null
  };
}

export function linhaParaMarcador(linha: LinhaMarcador, dataId: number): BooksDbBookmarkData {
  let progress: number | string | undefined;

  if (linha.progress !== null) {
    progress = linha.progress.endsWith('%') ? linha.progress : Number(linha.progress);
  }

  return {
    dataId,
    progress,
    ...(linha.scroll_x === null ? {} : { scrollX: linha.scroll_x }),
    ...(linha.scroll_y === null ? {} : { scrollY: linha.scroll_y }),
    ...(linha.explored_char_count === null ? {} : { exploredCharCount: linha.explored_char_count }),
    lastBookmarkModified: deIso(linha.modified_at)
  };
}

export function estatisticaParaLinha(
  livroId: string,
  estatistica: BooksDbStatistic,
  aparelho: Aparelho
): NovaLinhaEstatistica {
  return {
    book_id: livroId,
    date_key: estatistica.dateKey,
    device_id: aparelho.id,
    characters_read: estatistica.charactersRead,
    reading_time: estatistica.readingTime,
    min_reading_speed: estatistica.minReadingSpeed,
    alt_min_reading_speed: estatistica.altMinReadingSpeed,
    last_reading_speed: estatistica.lastReadingSpeed,
    max_reading_speed: estatistica.maxReadingSpeed,
    completed_book: !!estatistica.completedBook,
    completed_data: (estatistica.completedData ?? null) as NovaLinhaEstatistica['completed_data'],
    modified_at: paraIso(estatistica.lastStatisticModified),
    deleted_at: null
  };
}

export function linhaParaEstatistica(linha: LinhaEstatistica, titulo: string): BooksDbStatistic {
  return {
    title: titulo,
    dateKey: linha.date_key,
    charactersRead: linha.characters_read,
    readingTime: linha.reading_time,
    minReadingSpeed: linha.min_reading_speed,
    altMinReadingSpeed: linha.alt_min_reading_speed,
    lastReadingSpeed: linha.last_reading_speed,
    maxReadingSpeed: linha.max_reading_speed,
    lastStatisticModified: deIso(linha.modified_at),
    ...(linha.completed_book ? { completedBook: 1 } : {}),
    ...(linha.completed_data
      ? { completedData: linha.completed_data as unknown as BooksDbStatistic['completedData'] }
      : {})
  };
}

export function metaParaLinha(meta: BooksDbReadingGoal): NovaLinhaMeta {
  return {
    goal_start_date: meta.goalStartDate,
    goal_end_date: meta.goalEndDate || null,
    goal_original_end_date: meta.goalOriginalEndDate || null,
    goal_frequency: meta.goalFrequency,
    time_goal: meta.timeGoal,
    character_goal: meta.characterGoal,
    modified_at: paraIso(meta.lastGoalModified),
    deleted_at: null
  };
}

export function linhaParaMeta(linha: LinhaMeta): BooksDbReadingGoal {
  return {
    goalStartDate: linha.goal_start_date,
    goalEndDate: linha.goal_end_date ?? '',
    goalOriginalEndDate: linha.goal_original_end_date ?? '',
    goalFrequency: (linha.goal_frequency ?? 'daily') as BooksDbReadingGoal['goalFrequency'],
    timeGoal: linha.time_goal,
    characterGoal: linha.character_goal,
    lastGoalModified: deIso(linha.modified_at)
  };
}

/** "Você parou no iPad, cap. 3 (42%). Ir para lá?" (ESCOPO "Continuar em outro aparelho"). */
export function textoMarcadorRemoto(
  linha: Pick<LinhaMarcador, 'device_name' | 'explored_char_count'>,
  livro: { characters: number; sections?: { startCharacter?: number; parentChapter?: string }[] }
) {
  const lido = linha.explored_char_count || 0;
  const capitulos = (livro.sections || []).filter(
    (secao) => !secao.parentChapter && secao.startCharacter !== undefined
  );
  const indice = capitulos.reduce(
    (atual, secao, posicao) => ((secao.startCharacter as number) <= lido ? posicao : atual),
    -1
  );
  const porcentagem = livro.characters ? Math.floor((100 * lido) / livro.characters) : 0;
  const capitulo = indice >= 0 ? `, cap. ${indice + 1}` : '';

  return `Você parou no ${linha.device_name || 'outro aparelho'}${capitulo} (${porcentagem}%). Ir para lá?`;
}

/** Nome do aparelho pelo navegador. O iPadOS se apresenta como Mac, mas tem toque. */
export function nomeDoAparelho(userAgent: string, pontosDeToque: number) {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && pontosDeToque > 1)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Macintosh/.test(userAgent)) return 'Mac';
  return 'Navegador';
}

/** Pastas do bucket `epubs` de um livro: `<user_id>/<hash>/...` (ADR 0001). */
export function caminhosDoLivro(userId: string, livroId: string) {
  const pasta = `${userId}/${livroId}`;

  return {
    processado: `${pasta}/processado.zip`,
    original: `${pasta}/original.epub`,
    capa: `${pasta}/capa`
  };
}

export async function hashDoArquivo(dados: ArrayBuffer) {
  const resumo = await crypto.subtle.digest('SHA-256', dados);

  return [...new Uint8Array(resumo)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
