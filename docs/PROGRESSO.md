# Progresso

Atualize ao fim de cada chat. Curto: o próximo chat lê isto primeiro.

## Estado

| Item      | Status   | Data       | Observação                                                                  |
| --------- | -------- | ---------- | --------------------------------------------------------------------------- |
| S1        | feito    | 2026-10-20 | ttu roda; vitest; supabase init + link                                      |
| S2        | quase    | 2026-10-20 | schema aplicado, login ok; falta conta + cadastro desligado (👤)            |
| D1        | feito    | 2026-10-20 | telas aprovadas; regra dos toques B; protótipo no branch prototype/d1-telas |
| R1        | pendente |            |                                                                             |
| R2        | pendente |            |                                                                             |
| R3        | pendente |            | zips em dicts/; subir para o bucket no S2                                   |
| R4        | pendente |            | depende de R2 e R3                                                          |
| R5        | pendente |            |                                                                             |
| V1.1–V1.7 | pendente |            |                                                                             |
| V2.1–V2.4 | pendente |            |                                                                             |

## Decisões tomadas durante a construção

- 2026-10-15: backend trocado de Appwrite para Supabase (projeto já criado). ESCOPO atualizado.
- 2026-10-15: dicionários num bucket privado `dicts` do Supabase (não no git nem no site público).
- 2026-10-15: hospedagem na Vercel. Secret do Gemini se chama `GEMINI_KEY`.
- 2026-10-15: deck `日本語::1. Dokusho` (CARDS.md manda nos IDs); no app, áudio WAV e etiqueta só `dokusho`.
- 2026-10-20: entrevista de escopo. ESCOPO, CLAUDE.md, CARDS.md e FASES.md reescritos; registro em
  docs/ENTREVISTA.md, 11 ADRs em docs/adr/, termos em GLOSSARY.md. Principais mudanças: significado
  da carta em português pelo Gemini; guid com leitura; dicionário preparado no PC; "Já sei"; cards
  pelas conversas do Claude abandonados; Anki renomeado para 1. Dokusho / 2. Kaishi 1.5k / 3. Old.
- 2026-10-20: D1 aprovado no iPhone. Regra dos toques B: a barra do topo vem pela rolagem para cima;
  tocar fora do texto ou na pontuação só fecha o painel. Painel e telas aprovados sem mudanças.
  Detalhes em ESCOPO "Toque e painel" e logo abaixo da tabela de telas. Protótipo (descartável) no
  branch prototype/d1-telas, publicado como artifact privado.
- 2026-10-20: S1. pnpm 12.14.0 fixado em `packageManager` (avisa que ignora `pnpm.onlyBuiltDependencies`;
  o `allowBuilds` do pnpm-workspace.yaml cobre). vitest 3.2.4 (compatível com o vite 5.4). Supabase CLI
  2.121.0 como devDependency da raiz. `supabase status` não serve de prova de link (é da stack local);
  usar `npx supabase migration list`. No Windows, `corepack enable` sem admin dá EPERM: usar
  `--install-directory "$env:APPDATA\npm"`; `npx.ps1` exige ExecutionPolicy RemoteSigned (já feito).
- 2026-10-20: S2. Migração `20261020120000_schema_inicial.sql` aplicada (10 tabelas, RLS, buckets
  `epubs`/`audio`/`dicts` com pasta `<user_id>/`). Cada tabela tem `modified_at` (horário do aparelho);
  o trigger `touch_row` grava `updated_at` do servidor e **ignora update com `modified_at` mais velho**
  (LWW no servidor; um upsert perdedor não devolve linha). Sem FKs entre tabelas do app (ordem de
  sincronização livre). `gemini_usage`: o app só lê. Campos de `batch_items` em colunas, nomes do CARDS.md.
  Cliente em `apps/web/src/lib/data/supabase/` (`client.ts` lê `$env/static/public`;
  `create-client.ts` sem `$env`, para testes). Tela `/login` (a `/auth` continua sendo o callback do
  ttu); link em Configurações → Data → Conta; nada exige login ainda. `skipLibCheck` no tsconfig
  (tipos do auth-js brigam com o DOM do TS 6); `pnpm check` tem 27 erros, todos antigos do ttu.
  `rls.test.ts` fala com o projeto real (pulado sem .env); o teste "cadastro está desligado" falha até
  você desligar o cadastro. Verificação entre usuários: colar `supabase/tests/rls_check.sql` no SQL Editor.
- 2026-10-20: na primeira carga do `pnpm dev` o console mostra erros de HMR (o Vite reotimiza as
  dependências no meio); some ao recarregar. Não é bug do app.
- 2026-10-20: `pnpm build` com o `pnpm dev` rodando derruba o dev no Windows (EBUSY ao vigiar
  `apps/web/build/`). Rodar o build com o dev parado, ou subir o dev de novo depois.

## Testes de risco

(resultados de R1–R5 aqui)

## Pendências do usuário

- [x] docs/CARDS.md
- [x] apps/web/.env com URL e anon key
- [x] Dicionários em dicts/ (JMdict_english, JPDB v2.2 Frequency Kana)
- [x] Secret GEMINI_KEY no Supabase
- [x] Hospedagem: Vercel
- [ ] Conectar o repo na Vercel e cadastrar as env vars (V1.7)
- [ ] Criar a sua conta (Auth → Add user), entrar em `/login`, desligar o cadastro (Auth → Sign In /
      Providers → "Allow new users to sign up") e rodar `pnpm test` + `supabase/tests/rls_check.sql` (S2)
- [ ] Alerta de orçamento no Google Cloud e confirmar que a GEMINI_KEY é do projeto pago (R5)
- [ ] Escolher o subdomínio da Vercel e desligar previews (V1.7)

## Sem decisão (da entrevista de 20/10)

- Modo de leitura no PC; como mostrar a barra do topo onde não há rolagem (modo de páginas, começo de
  capítulo): decidir no V1.3 (sugestão: faixa do topo ou mouse no topo).
- Números: frequência N do "Já sei" inicial, teto diário do Gemini, valor do alerta, corte da frase,
  intervalo do marcador, prazo do áudio.
- Não discutidos: detalhes da tela inicial (início da semana, virada do dia, fuso em viagem), metas,
  desfazer "Já sei", tela Vocabulário, restaurar backup (substituir ou mesclar), fontes e acessibilidade.
