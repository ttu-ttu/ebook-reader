-- Sincronização do ttu pelo Supabase (V1.1; ADR 0014). Só colunas novas.

-- Marcador: de que aparelho veio, para perguntar "Você parou no iPad. Ir para lá?".
alter table public.bookmarks
  add column device_id text,
  add column device_name text;

-- Livro: tamanho do processado, para mostrar o download na biblioteca.
alter table public.books
  add column processed_size bigint;

-- Meta: a frequência (diária, semanal, mensal) que o ttu guarda em cada meta.
alter table public.reading_goals
  add column goal_frequency text;
