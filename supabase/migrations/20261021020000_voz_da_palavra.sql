-- Voz da palavra em cadeia (R5): dica de leitura → conferência → kana → marca.
--   dica     a voz leu a palavra escrita com a leitura como dica, e a conferência bateu
--   kana     a dica falhou; a voz leu a leitura em kana, e a conferência bateu
--   confira  nem a kana bateu na conferência: a fila marca a carta para você ouvir
-- null: ainda sem voz da palavra, ou voz feita antes da cadeia.
alter table public.batch_items
  add column word_audio_check text check (word_audio_check in ('dica', 'kana', 'confira'));
