/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Backup (ESCOPO "Backup"): o plano gratuito do Supabase não dá backup para baixar. "Baixar backup"
// gera um zip com todas as tabelas em JSON (sem EPUBs e áudios); "Restaurar backup" sobe as linhas
// de volta mesclando: a última escrita vence pelo horário do aparelho (ADR 0002), então restaurar
// nunca apaga nem desfaz o que é mais novo. Sem imports: testado no Node.

export const FORMATO_BACKUP = 1;

export const TABELAS_DO_BACKUP = [
  'books',
  'bookmarks',
  'reading_stats',
  'reading_goals',
  'vocab',
  'vocab_history',
  'translations',
  'lotes',
  'batch_items'
] as const;

export type TabelaDoBackup = (typeof TABELAS_DO_BACKUP)[number];

/** Chave primária de cada tabela (o upsert da restauração). */
export const CHAVES_DO_BACKUP: Record<TabelaDoBackup, string> = {
  books: 'user_id,id',
  bookmarks: 'user_id,book_id',
  reading_stats: 'user_id,book_id,date_key,device_id',
  reading_goals: 'user_id,goal_start_date',
  vocab: 'user_id,word,reading',
  vocab_history: 'user_id,id',
  translations: 'user_id,sentence_sha256',
  lotes: 'user_id,id',
  batch_items: 'user_id,id'
};

type Linha = Record<string, unknown>;

const MANIFESTO = 'manifesto.json';

/** [nome do arquivo, conteúdo] do zip: o manifesto e um JSON por tabela. */
export function arquivosDoBackup(
  tabelas: Partial<Record<TabelaDoBackup, Linha[]>>,
  criadoEm: string
): [string, string][] {
  const linhas = Object.fromEntries(
    Object.entries(tabelas).map(([tabela, lista]) => [tabela, lista?.length ?? 0])
  );

  return [
    [MANIFESTO, JSON.stringify({ formato: FORMATO_BACKUP, criadoEm, linhas })],
    ...Object.entries(tabelas).map(
      ([tabela, lista]) => [`${tabela}.json`, JSON.stringify(lista ?? [])] as [string, string]
    )
  ];
}

export function lerBackup(arquivos: Map<string, string>) {
  const manifesto = arquivos.get(MANIFESTO);

  if (!manifesto) throw new Error('Este arquivo não é um backup do Dokusho');

  const { formato, criadoEm } = JSON.parse(manifesto) as { formato: number; criadoEm: string };

  if (formato !== FORMATO_BACKUP) throw new Error(`Backup no formato ${formato}, desconhecido`);

  const tabelas: Partial<Record<TabelaDoBackup, Linha[]>> = {};

  for (const tabela of TABELAS_DO_BACKUP) {
    const conteudo = arquivos.get(`${tabela}.json`);

    if (conteudo) tabelas[tabela] = JSON.parse(conteudo) as Linha[];
  }

  return { criadoEm, tabelas };
}

/** As linhas passam a ser do usuário atual (RLS); o updated_at é do servidor (cursor). */
export function linhasParaRestaurar(linhas: Linha[], userId: string) {
  return linhas.map((linha) => {
    const { updated_at: _, ...resto } = linha;

    return { ...resto, user_id: userId };
  });
}

export function diasDesde(ms: number | undefined, agora: number) {
  return ms === undefined ? undefined : Math.floor((agora - ms) / 86_400_000);
}
