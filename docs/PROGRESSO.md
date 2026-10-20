# Progresso

Atualize ao fim de cada chat. Curto: o próximo chat lê isto primeiro.

## Estado

| Item | Status | Data | Observação |
| --- | --- | --- | --- |
| S1 | pendente | | |
| S2 | pendente | | |
| D1 | pendente | | protótipo das telas; pode rodar em paralelo |
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
- 2026-10-20: entrevista de escopo. ESCOPO, CLAUDE.md, CARDS.md e FASES.md reescritos; registro em
  docs/ENTREVISTA.md, 11 ADRs em docs/adr/, termos em GLOSSARY.md. Principais mudanças: significado
  da carta em português pelo Gemini; guid com leitura; dicionário preparado no PC; "Já sei"; cards
  pelas conversas do Claude abandonados; Anki renomeado para 1. Dokusho / 2. Kaishi 1.5k / 3. Old.

## Testes de risco

(resultados de R1–R5 aqui)

## Pendências do usuário

- [x] docs/CARDS.md
- [x] apps/web/.env com URL e anon key
- [x] Dicionários em dicts/ (JMdict_english, JPDB v2.2 Frequency Kana)
- [x] Secret GEMINI_KEY no Supabase
- [x] Hospedagem: Vercel
- [ ] Conectar o repo na Vercel e cadastrar as env vars (V1.7)
- [ ] Desligar o cadastro no Supabase depois de criar a conta (S2)
- [ ] Alerta de orçamento no Google Cloud e confirmar que a GEMINI_KEY é do projeto pago (R5)
- [ ] Escolher o subdomínio da Vercel e desligar previews (V1.7)

## Sem decisão (da entrevista de 20/10)

- Modo de leitura no PC; regra dos toques (confirmar no D1).
- Números: frequência N do "Já sei" inicial, teto diário do Gemini, valor do alerta, corte da frase,
  intervalo do marcador, prazo do áudio.
- Não discutidos: detalhes da tela inicial (início da semana, virada do dia, fuso em viagem), metas,
  desfazer "Já sei", tela Vocabulário, restaurar backup (substituir ou mesclar), fontes e acessibilidade.
