# Dokusho: leitor de EPUB japonês

Especificação: docs/ESCOPO.md. Formato dos cards: docs/CARDS.md (fonte única).
Roteiro de chats: docs/FASES.md. Estado atual: docs/PROGRESSO.md (ler no início de todo chat).
Termos: GLOSSARY.md (usar esses nomes no código e nos docs). Decisões com motivo: docs/adr/ (não
desfazer um ADR sem um novo ADR).

## Stack

- Fork do ttu ebook-reader (SvelteKit 2 + Svelte 4, Tailwind, adapter-static, pnpm). App em apps/web.
- Dados locais do ttu: IndexedDB (apps/web/src/lib/data/database/books-db).
- Sincronização do ttu: handlers em apps/web/src/lib/data/storage/handler. O Supabase entra como um
  handler novo nesse padrão e é a única sincronização (Drive, OneDrive e pasta local saem da interface;
  audiobook e legendas viram no-op).
- Supabase: Auth (e-mail + senha, cadastro desligado), Postgres com RLS, Storage (buckets `epubs`,
  `audio`, `dicts`), Edge Function `gemini` (ações `translate` e `generate`).
  Schema em supabase/migrations/. Cliente: @supabase/supabase-js.
- Hospedagem: Vercel (build estático do adapter-static), só `main`, sem previews.
- .apkg: port do genanki em apps/web/src/lib/functions/anki (sql.js + @zip.js), testado contra a
  saída do genanki.
- Dicionários: zips Yomitan em dicts/ (local, fora do git) → script em tools/ converte para o formato
  do app (JMdict + JPDB + JmdictFurigana) → bucket privado `dicts` → cada aparelho baixa e grava no
  IndexedDB (ADR 0004). Nada pesado em `static/` (o service worker rebaixa tudo a cada deploy).
- Tokenizador: lindera-wasm-ipadic (wasm com IPADIC embutido; forma de dicionário em `details[6]`,
  leitura em `details[7]`), guardado num cache próprio fora do cache de build (ADR 0012).
- Glosas do painel em inglês (JMdict). Busca própria; deflexão pela forma de dicionário do
  tokenizador, com regras próprias de reserva (ADR 0005). Não copiar código do Yomitan (GPL).

## Comandos

- Instalar: pnpm install --frozen-lockfile (na raiz; pnpm 12.14.0 fixado em `packageManager`, via
  `corepack enable`; sem admin no Windows: `corepack enable --install-directory "$env:APPDATA\npm"`)
- Rodar: pnpm dev
- Build: pnpm build
- Checagem de tipos: cd apps/web && pnpm check
- Testes: pnpm test (na raiz; vitest em apps/web, arquivos `src/**/*.test.ts`)
- Supabase: npx supabase <cmd> (link, db push, functions deploy gemini, secrets set). CLI fixado
  como devDependency da raiz. Projeto já linkado (ref em supabase/.temp, fora do git); checar o link
  com `npx supabase migration list` (`supabase status` é da stack local em Docker).
- Edge Function: npx supabase functions deploy gemini --use-api (sem Docker). Secrets de configuração:
  GEMINI_MODELOS_TEXTO e GEMINI_MODELOS_TTS (listas com reserva, separadas por vírgula),
  GEMINI_TETO_DIARIO. Lógica pura em supabase/functions/gemini/\*.ts sem imports (testada pelo vitest);
  só o index.ts usa Deno. verify_jwt = false em toda função (os tokens do Auth são ES256 e o gateway
  só aceita os antigos); a função confere o login com auth.getUser.
- Cartas de teste (R5): node tools/gerar-cartas-teste.ts [dicts/r5] (pede e-mail e senha; quem roda é
  o usuário); lê cartas.json e precos.json da pasta e grava relatorio.html.
- Referência do genanki (R1): py -3.14 -m venv tools/.venv; tools/.venv/Scripts/python -m pip
  install -r tools/requirements.txt; tools/.venv/Scripts/python tools/genanki_referencia.py (regrava
  a fixture dos testes do .apkg; Python 3.15 não serve).
- Tipos do banco: npx supabase gen types typescript --linked --schema public >
  apps/web/src/lib/data/supabase/database.types.ts (rodar depois de cada migração).
- Dicionário (na raiz, Node 24): node tools/preparar-dicionario.ts (zips de dicts/ → dicts/saida/<versao>/);
  node tools/subir-dicionario.ts (pede e-mail e senha no terminal; quem roda é o usuário). Formato em
  apps/web/src/lib/data/dicionario/formato.ts (sem imports: o Node roda o .ts direto).

## Regras fixas

- Repositório público: nunca chave, dado pessoal ou link privado em arquivo versionado.
- Nenhuma chamada a Claude/LLM dentro do app. Só Gemini, só pela Edge Function `gemini`.
- Chaves: GEMINI_API_KEY só como secret do Supabase (ler com Deno.env.get("GEMINI_API_KEY")). A função
  aceita só o usuário do secret ALLOWED_USER_ID e respeita um teto diário. Nomes de modelo em
  configuração, nunca no código. No front, só SUPABASE_URL e a anon key (via .env, PUBLIC\*\*).
  Nunca service_role no front. Nunca chaves no código nem no chat.
- Termos: **Carta** = item da fila no app; **Card** = o que existe no Anki.
- Cards: seguir docs/CARDS.md; não mudar MODEL_ID nem o prefixo de guid `leituras-igor`.
  guid = guid_for("leituras-igor", palavra, leitura) (ADR 0006). Deck: 日本語::1. Dokusho — o Anki
  casa o deck pelo nome, então o nome é exato. Word Meaning e Sentence Meaning em português, pelo
  Gemini (ADR 0009); áudio WAV sem conversão; etiquetas `dokusho` e `dokusho::<título>`.
- Estados do hub: conhecida (suspenso sem etiqueta `leech`, intervalo >= 21 dias, ou "Já sei"),
  aprendendo (ativo com intervalo < 21 dias, inclusive novos, ou suspenso com `leech`),
  desconhecida (fora do Anki e sem "Já sei"). Vale o estado mais avançado. Texto e Anki casam pela
  entrada do JMdict, com qualquer leitura (ADR 0008, 0013). Gramática fora da cobertura.
- AnkiConnect: nunca `getDeckStats` (cria deck quando o nome não existe). `webCorsOriginList` só
  com as URLs exatas, nunca `*`. O cliente (functions/anki/anki-connect.ts) só aceita uma lista
  fixa de ações de leitura mais `sync`; configuração em docs/ANKI-CONNECT.md.
- Toda tabela: user_id, updated_at, deleted_at; RLS user_id = auth.uid(). Exclusão = soft delete.
  Última escrita vence pelo horário do aparelho; updated_at do servidor só como cursor (ADR 0002).
- Livro identificado pelo hash do EPUB, nunca pelo título (ADR 0001).
- vocab: chave (user_id, word, reading), gravar com upsert.
- Service worker: sem skipWaiting automático (ADR 0011).
- Escrever teste antes do código em: guid/.apkg, estados do hub, casamento de palavras, deflexão.

## Fluxo

- Um chat por item de docs/FASES.md. Começar em plan mode, implementar, testar.
- Um commit por passo pequeno (Conventional Commits: o repo usa commitlint).
- Ao terminar o item: atualizar docs/PROGRESSO.md (feito, decisões, pendências) e este arquivo
  se mudou stack, comando ou regra.
