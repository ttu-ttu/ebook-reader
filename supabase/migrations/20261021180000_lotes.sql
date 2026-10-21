-- Exportação .apkg (V1.6). Só colunas novas.

-- Lote: o nome do aparelho onde foi baixado ("20/10 · iPhone") e quando o áudio das cartas dele
-- saiu do bucket (30 dias depois de baixado).
alter table public.lotes
  add column device_name text,
  add column audio_deleted_at timestamptz;
