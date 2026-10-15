# Roteiro de chats

Cada item abaixo é **um chat novo** no Claude Code, com o modelo **Sonnet**. Os itens são pequenos
de propósito: o Sonnet rende bem quando o contexto é curto e o critério de pronto é claro.

## Como rodar cada chat

1. Abra um chat novo (ou `/clear`), modelo Sonnet, **plan mode** ligado.
2. Cole o prompt padrão trocando o código do item:

   ```
   Vamos fazer o item <CÓDIGO> de docs/FASES.md.
   Leia CLAUDE.md, docs/PROGRESSO.md e só as seções do docs/ESCOPO.md que o item cita.
   Faça um plano curto, espere eu aprovar, implemente com commits pequenos,
   rode os testes/checagens e, no fim, atualize docs/PROGRESSO.md.
   ```

3. Leia o plano antes de aprovar. Se o Sonnet travar duas vezes no mesmo bug, troque para Opus
   **só naquela rodada** (`/model opus`) e volte para Sonnet depois.
4. Itens marcados com 👤 precisam de algo seu (arquivo, chave, teste em aparelho).

Ordem: siga a numeração. Itens na mesma linha "∥" podem rodar em paralelo em chats diferentes,
desde que não mexam nos mesmos arquivos.

---

## S. Preparação

### S1 · Ambiente e Supabase 👤
- `corepack enable`, `pnpm install`, `pnpm dev` rodando o ttu sem mudanças.
- Adicionar vitest em apps/web com um teste trivial; preencher "Testes" no CLAUDE.md.
- `npx supabase init`, `npx supabase link` ao seu projeto (você faz o login no terminal).
- `apps/web/.env` com `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` (você cola no arquivo,
  não no chat); `.env.example` versionado.
- **Pronto quando:** `pnpm dev` abre o ttu, `pnpm test` passa, `npx supabase status`/link ok.

### S2 · Schema e Auth
- Migração em supabase/migrations com as 8 tabelas do ESCOPO ("Arquitetura e modelo de dados"),
  colunas user_id/updated_at/deleted_at, RLS, trigger de updated_at, buckets `epubs`, `audio` e `dicts`
  com política por pasta `<user_id>/`.
- Script tools/upload-dicts (Node) que sobe os zips de `dicts/` (pasta local, fora do git) para o
  bucket `dicts`, logado como você.
- Tipos TS gerados (`npx supabase gen types`).
- Tela de login simples no app (e-mail + senha ou magic link) e cliente supabase em apps/web/src/lib.
- **Pronto quando:** `npx supabase db push` aplica; login funciona; outro usuário não lê seus dados.

## 0. Testes de risco (ESCOPO: "Riscos e testes antes de construir")

Resultados de cada teste vão para docs/PROGRESSO.md, na seção "Testes de risco".

### R1 · guid e .apkg 👤 (precisa de docs/CARDS.md)
- Port TS do `guid_for` do genanki e do gerador de .apkg (sql.js + zip). Testes primeiro,
  comparando com a saída do genanki em Python (script em tools/).
- **Pronto quando:** testes batem com o Python; você importa no Anki do PC e no AnkiMobile,
  reimporta e não duplica nem altera o tipo de nota do Kaishi.

### R2 · AnkiConnect pelo navegador ∥ R3 👤
- Página de teste no app que faz `fetch` a localhost:8765 (findCards/cardsInfo/notesInfo
  nos decks 日本語::*). Documentar o `webCorsOriginList` necessário.
- **Pronto quando:** no Chrome do Windows a página lista seus cartões com intervalo e suspensão.

### R3 · Tokenizador e dicionário ∥ R2 👤 (zips já em `dicts/` e no bucket `dicts`: JMdict_english, JPDB v2.2 Frequency Kana)
- Escolher tokenizador que roda no navegador (comparar kuromoji.js vs. sudachi/lindera wasm:
  tamanho, velocidade, qualidade de leitura). Registrar a escolha no CLAUDE.md.
- Importador Yomitan → IndexedDB (protótipo) que baixa o zip do bucket `dicts`; medir tamanho do
  download, tempo de import e de consulta.
- **Pronto quando:** números medidos no PC e na PWA do iPhone anotados.

### R4 · Casamento texto ↔ Anki (depende de R2 e R3)
- Tokenizar um EPUB, casar com (Word, Word Reading) do Anki; medir taxa; listar homófonos e
  palavras só em kana. Testes primeiro para as regras de casamento.
- **Pronto quando:** taxa anotada e regras ajustadas.

### R5 · Edge Function `gemini` (secret `GEMINI_KEY` já criado no Supabase)
- Função Deno com `action: translate | tts`, exige usuário autenticado; cache em `translations`.
  TTS: modelo e voz de docs/CARDS.md (seção "Áudio": voz Orus); saída WAV, nome
  `leituras-<sha1(voz|texto)[:12]>.wav` como no script.
- Script que gera 30 traduções + áudios WAV; medir tamanho médio do áudio e estimar 1 GB.
- **Pronto quando:** você ouviu/leu as 30 e anotou o veredito; estimativa de storage anotada.

## 1. v1

### V1.1 · Sincronização do ttu pelo Supabase
- Novo handler em apps/web/src/lib/data/storage/handler no padrão dos existentes:
  books (EPUB no bucket), bookmarks, reading_stats, reading_goals. LWW + soft delete.
- **Pronto quando:** livro importado no PC aparece no iPad no mesmo ponto de leitura.

### V1.2 · Dicionário embutido (a partir do protótipo de R3)
- Importação Yomitan na tela de configurações, deflexão própria com testes, busca por forma
  de dicionário, frequência.
- **Pronto quando:** testes de deflexão passam; consulta em < X ms (meta definida em R3).

### V1.3 · Toque na palavra e painel
- Seleção pelo tokenizador (palavra inteira, sem partícula, área de toque grande), painel
  inferior (lateral no iPad/PC): palavra, leitura, glosa EN, botão "Traduzir frase" (usa a
  função de R5 + cache), botão "Virar cartão" (só grava em batch_items como pendente).
- **Pronto quando:** teste de 30 toques no iPhone com poucas seleções erradas (anotar).

### V1.4 · Tela inicial e navegação ∥ V1.5
- Navegação inferior (Início, Biblioteca, Fila; Vocabulário oculto até v2), calendário da
  semana, meta, abas tempo/caracteres, gráfico por dia, filtro 7/30/tudo, lista por livro.
- **Pronto quando:** números batem com as estatísticas do ttu.

### V1.5 · Fila de cartas ∥ V1.4
- Tela da fila; geração dos 14 campos (docs/CARDS.md): furigana da palavra e da frase,
  tradução (reaproveita cache), áudio WAV no bucket `audio`; pendente offline; editar campos.
- **Pronto quando:** 10 palavras viram cartas geradas e editáveis.

### V1.6 · Exportar .apkg (usa R1)
- Botão "Exportar .apkg" com todas as geradas + mídia; marca como exportada.
- **Pronto quando:** as 10 cartas importam no Anki com áudio; reimportar não duplica.

### V1.7 · PWA e deploy na Vercel 👤 (você conecta o repo na Vercel e cola as env vars lá)
- Manifest/ícone, cache offline (service worker do ttu), build estático, deploy, URL de
  redirect do Auth no Supabase.
- **Pronto quando:** critério da v1 no ESCOPO ("Roadmap por versão") cumprido de ponta a ponta.

## 2. v2

### V2.1 · Sincronizar Anki e estados (usa R2 e R4)
- Botão "Sincronizar Anki" (só Windows), cálculo de estado com testes primeiro, upsert em vocab,
  retrato em vocab_history, data da última sincronização.

### V2.2 · Destaque no texto e aviso na fila

### V2.3 · Cobertura por livro e lista de desconhecidas por frequência

### V2.4 · Tela Vocabulário e aba de palavras conhecidas na tela inicial
- **Pronto quando (v2):** critério da v2 no ESCOPO.

## 3. v3 (opcional, um chat por item)

- V3.1 Kanji conhecidos para folhas de escrita
- V3.2 Estatísticas cruzando leitura e vocabulário
- V3.3 Exportar CSV de conhecidas e aprendendo
- V3.4 Furigana adaptativo
