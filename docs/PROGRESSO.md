# Progresso

Atualize ao fim de cada chat. Curto: o próximo chat lê isto primeiro.

## Estado

| Item | Status | Data | Observação |
| --- | --- | --- | --- |
| S1 | pendente | | |
| S2 | pendente | | |
| R1 | bloqueado | | falta docs/CARDS.md |
| R2 | pendente | | |
| R3 | pendente | | falta baixar JMdict EN + frequência (Yomitan) |
| R4 | pendente | | depende de R2 e R3 |
| R5 | pendente | | falta secret GEMINI_API_KEY |
| V1.1–V1.7 | pendente | | |
| V2.1–V2.4 | pendente | | |

## Decisões tomadas durante a construção

- 2026-10-15: backend trocado de Appwrite para Supabase (projeto já criado). ESCOPO atualizado.

## Testes de risco

(resultados de R1–R5 aqui)

## Pendências do usuário

- [ ] Colocar o documento "Cards de Anki: formato e gerador" em docs/CARDS.md
- [ ] Preencher apps/web/.env com URL e anon key do Supabase (S1)
- [ ] Baixar JMdict (inglês) e uma lista de frequência no formato Yomitan (R3)
- [ ] Gerar chave do Gemini e rodar `npx supabase secrets set` (R5)
- [ ] Escolher hospedagem estática (V1.7)
