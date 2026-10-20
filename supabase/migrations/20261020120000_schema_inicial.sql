-- Schema inicial do Dokusho (ESCOPO "Arquitetura e modelo de dados"; ADR 0001, 0002).
--
-- Toda tabela tem:
--   user_id      dono da linha; RLS user_id = auth.uid()
--   modified_at  horário do aparelho em que você agiu; decide a última escrita (ADR 0002)
--   updated_at   horário do servidor; só cursor para "o que mudou desde a última vez"
--   deleted_at   soft delete; exclusão nunca apaga a linha
--
-- Sem chaves estrangeiras entre as tabelas do app: cada aparelho sobe as tabelas em qualquer ordem,
-- e uma carta ou estatística pode chegar antes do livro.

-- updated_at do servidor em todo insert/update, e a última escrita pelo horário do aparelho:
-- um update com modified_at mais velho que o gravado é ignorado (a linha fica como está).
create function public.touch_row() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.modified_at < old.modified_at then
    return null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Livro: id = hash do EPUB (ADR 0001); o título só é exibido.
create table public.books (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  title text not null,
  cover_path text,
  characters integer not null default 0,
  processed_path text,
  original_path text,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- Marcador (campos do ttu) e Alcance, um por livro.
create table public.bookmarks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id text not null,
  progress text,
  scroll_x double precision,
  scroll_y double precision,
  explored_char_count integer,
  reach_char_count integer,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, book_id)
);

-- Uma linha por livro, dia e aparelho; a exibição soma os aparelhos (ADR 0002).
create table public.reading_stats (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id text not null,
  date_key date not null,
  device_id text not null,
  characters_read integer not null default 0,
  reading_time double precision not null default 0,
  min_reading_speed double precision not null default 0,
  alt_min_reading_speed double precision not null default 0,
  last_reading_speed double precision not null default 0,
  max_reading_speed double precision not null default 0,
  completed_book boolean not null default false,
  completed_data jsonb,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, book_id, date_key, device_id)
);

create table public.reading_goals (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_start_date date not null,
  goal_end_date date,
  goal_original_end_date date,
  time_goal integer not null default 0,
  character_goal integer not null default 0,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, goal_start_date)
);

-- Hub de vocabulário: Palavra = (word, reading); gravar com upsert nessa chave.
create table public.vocab (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  word text not null,
  reading text not null,
  jmdict_id bigint,
  source text not null check (source in ('anki', 'ja_sei')),
  state text not null check (state in ('conhecida', 'aprendendo')),
  interval_days integer,
  suspended boolean not null default false,
  leech boolean not null default false,
  synced_at timestamptz,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, word, reading)
);

-- Um retrato por Sincronização do Anki.
create table public.vocab_history (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null default gen_random_uuid(),
  synced_at timestamptz not null,
  known_count integer not null default 0,
  learning_count integer not null default 0,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- Cache da Tradução da frase.
create table public.translations (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  sentence_sha256 text not null,
  sentence text not null,
  translation text not null,
  translated_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, sentence_sha256)
);

create table public.lotes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null default gen_random_uuid(),
  exported_at timestamptz not null,
  device_id text not null,
  confirmed_in_anki_at timestamptz,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- Cartas da Fila. Campos do card conforme docs/CARDS.md; as cartas de um Lote são as de lote_id.
create table public.batch_items (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null default gen_random_uuid(),
  book_id text,
  jmdict_id bigint,
  word text not null,
  word_reading text not null,
  word_meaning text,
  word_furigana text,
  word_audio_path text,
  sentence text not null,
  sentence_meaning text,
  sentence_furigana text,
  sentence_audio_path text,
  notes text,
  frequency integer,
  voice_text text,
  state text not null default 'pendente'
    check (state in ('pendente', 'gerando', 'gerada', 'erro', 'exportada')),
  error_reason text,
  lote_id uuid,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- Contagem diária para o teto da Edge Function gemini.
create table public.gemini_usage (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  calls integer not null default 0,
  modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, day)
);

-- Trigger, índice do cursor e RLS em todas as tabelas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'books', 'bookmarks', 'reading_stats', 'reading_goals', 'vocab', 'vocab_history',
    'translations', 'lotes', 'batch_items', 'gemini_usage'
  ] loop
    execute format(
      'create trigger touch_row before insert or update on public.%I
         for each row execute function public.touch_row()', t);
    execute format('create index %I on public.%I (user_id, updated_at)', t || '_cursor', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array[
    'books', 'bookmarks', 'reading_stats', 'reading_goals', 'vocab', 'vocab_history',
    'translations', 'lotes', 'batch_items'
  ] loop
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- gemini_usage: o app só lê; quem grava é a Edge Function.
create policy own_rows_read on public.gemini_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Buckets privados; cada usuário só mexe na pasta <user_id>/.
insert into storage.buckets (id, name, public)
values ('epubs', 'epubs', false), ('audio', 'audio', false), ('dicts', 'dicts', false);

create policy own_folder on storage.objects for all to authenticated
  using (
    bucket_id in ('epubs', 'audio', 'dicts')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('epubs', 'audio', 'dicts')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
