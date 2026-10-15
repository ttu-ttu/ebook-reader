# Progresso

Atualize ao fim de cada chat. Curto: o próximo chat lê isto primeiro.

## Estado

| Item | Status | Data | Observação |
| --- | --- | --- | --- |
| S1 | pendente | | |
| S2 | pendente | | |
| R1 | pendente | | |
| R2 | pendente | | |
| R3 | pendente | | zips em dicts/; subir para o bucket no S2 |
| R4 | pendente | | depende de R2 e R3 |
| R5 | pendente | | |
| V1.1–V1.7 | pendente | | |
| V2.1–V2.4 | pendente | | |

## Decisões tomadas durante a construção

- 2026-10-15: backend trocado de Appwrite para Supabase (projeto já criado). ESCOPO atualizado.
- 2026-10-15: dicionários num bucket privado `dicts` do Supabase (não no git nem no site público).
- 2026-10-15: hospedagem na Vercel. Secret do Gemini se chama `GEMINI_KEY`.
- 2026-10-15: deck `日本語::1. Dokusho` (CARDS.md manda nos IDs); no app, áudio WAV e etiqueta só `dokusho`.

## Testes de risco

(resultados de R1–R5 aqui)

## Pendências do usuário

- [x] docs/CARDS.md
- [x] apps/web/.env com URL e anon key
- [x] Dicionários em dicts/ (JMdict_english, JPDB v2.2 Frequency Kana)
- [x] Secret GEMINI_KEY no Supabase
- [x] Hospedagem: Vercel
- [ ] Conectar o repo na Vercel e cadastrar as env vars (V1.7)
