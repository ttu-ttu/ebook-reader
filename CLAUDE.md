# Dokusho: leitor de EPUB japonês

Especificação: docs/ESCOPO.md. Formato dos cards: docs/CARDS.md (fonte única).
Roteiro de chats: docs/FASES.md. Estado atual: docs/PROGRESSO.md (ler no início de todo chat).

## Stack
- Fork do ttu ebook-reader (SvelteKit 2 + Svelte 4, Tailwind, adapter-static, pnpm). App em apps/web.
- Dados locais do ttu: IndexedDB (apps/web/src/lib/data/database/books-db).
- Sincronização do ttu: handlers em apps/web/src/lib/data/storage/handler (gdrive, onedrive...).
  O Supabase entra como um handler novo nesse mesmo padrão.
- Supabase: Auth, Postgres com RLS, Storage (buckets `epubs` e `audio`), Edge Function `gemini`.
  Schema em supabase/migrations/. Cliente: @supabase/supabase-js.
- Dicionário embutido no formato Yomitan (IndexedDB), glosas em inglês. Busca e deflexão próprias (Yomitan é GPL).

## Comandos
- Instalar: pnpm install --frozen-lockfile (na raiz; pnpm via `corepack enable`)
- Rodar: pnpm dev
- Build: pnpm build
- Checagem de tipos: cd apps/web && pnpm check
- Testes: (preencher quando existirem — vitest em apps/web)
- Supabase: npx supabase <cmd> (link, db push, functions deploy gemini, secrets set)

## Regras fixas
- Nenhuma chamada a Claude/LLM dentro do app. Só Gemini, só pela Edge Function `gemini`.
- Chaves: GEMINI_API_KEY só como secret do Supabase. No front, só SUPABASE_URL e a anon key
  (via .env, PUBLIC_*). Nunca service_role no front. Nunca chaves no código nem no chat.
- Cards: seguir docs/CARDS.md; não mudar MODEL_ID, IDs dos decks nem prefixo de guid.
  Deck de destino: 日本語::3. Leitor.
- Estados do hub: conhecida (suspenso ou intervalo >= 21 dias), aprendendo (ativo com
  intervalo < 21 dias, inclusive novos), desconhecida (fora do Anki). Vale o estado mais avançado.
- Toda tabela: user_id, updated_at, deleted_at; RLS user_id = auth.uid().
  Exclusão = soft delete; merge por updated_at (última escrita vence).
- vocab: chave (user_id, word, reading), gravar com upsert.
- Glosas em inglês; só a tradução da frase é em português.
- Escrever teste antes do código em: guid/.apkg, estados do hub, casamento de palavras, deflexão.

## Fluxo
- Um chat por item de docs/FASES.md. Começar em plan mode, implementar, testar.
- Um commit por passo pequeno (Conventional Commits: o repo usa commitlint).
- Ao terminar o item: atualizar docs/PROGRESSO.md (feito, decisões, pendências) e este arquivo
  se mudou stack, comando ou regra.
