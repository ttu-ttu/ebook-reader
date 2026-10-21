# Roteiro de chats

Cada item abaixo é **um chat novo** no Claude Code, com o modelo **Sonnet** (Opus só no plano ou em
bug travado). Os itens são pequenos de propósito: o Sonnet rende bem quando o contexto é curto e o
critério de pronto é claro.

Atualizado em 2026-10-20 depois da entrevista de escopo (docs/ENTREVISTA.md, docs/adr/, GLOSSARY.md).

## Como rodar cada chat

1. Abra um chat novo (ou `/clear`), **plan mode** ligado.
2. Cole o prompt padrão trocando o código do item:

   ```
   Vamos fazer o item <CÓDIGO> de docs/FASES.md.
   Leia CLAUDE.md, docs/PROGRESSO.md, GLOSSARY.md, os ADRs que o item cita e só as seções do
   docs/ESCOPO.md que o item cita. Faça um plano curto, espere eu aprovar, implemente com commits
   pequenos, rode os testes/checagens e, no fim, atualize docs/PROGRESSO.md.
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
  `supabase/.temp` no `.gitignore`.
- `apps/web/.env` com `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` (você cola no arquivo,
  não no chat); `.env.example` versionado.
- **Pronto quando:** `pnpm dev` abre o ttu, `pnpm test` passa, `npx supabase status`/link ok.

### S2 · Schema e Auth (ESCOPO: "Arquitetura e modelo de dados"; ADR 0001, 0002)

- Migração em supabase/migrations com as 10 tabelas do ESCOPO, colunas user_id/updated_at/deleted_at,
  RLS, trigger de updated_at (servidor, só cursor), buckets `epubs`, `audio` e `dicts` com política
  por pasta `<user_id>/`.
- Tela de login simples no app: **e-mail + senha, sem magic link**; cliente supabase em apps/web/src/lib.
- 👤 Criar a sua conta e depois **desligar o cadastro** no painel do Supabase.
- Tipos TS gerados (`npx supabase gen types`).
- **Pronto quando:** `npx supabase db push` aplica; login funciona; outro usuário não lê seus dados;
  cadastro novo é recusado.

### D1 · Protótipo das telas ∥ S1, S2, R\* 👤 (ESCOPO: "Interface", "Tela inicial")

- Protótipo descartável (HTML/Svelte solto, fora do app, dados falsos) em tamanho de iPhone:
  Início, Biblioteca, Leitor com painel da palavra, Fila de cartas com Lotes, tela de edição da carta.
- Confirmar a regra dos toques (ESCOPO "Toque e painel"), o conteúdo do painel e os estados da carta.
- **Pronto quando:** você aprovou as telas no iPhone; decisões e ajustes anotados no ESCOPO.

## 0. Testes de risco (ESCOPO: "Riscos e testes antes de construir")

Resultados de cada teste vão para docs/PROGRESSO.md, na seção "Testes de risco".

### R1 · guid e .apkg 👤 (docs/CARDS.md; ADR 0006)

- Port TS do `guid_for` do genanki (com palavra **e leitura**) e do gerador de .apkg (sql.js + zip).
  Testes primeiro, comparando com a saída do genanki em Python (script em tools/, com os valores de
  docs/CARDS.md).
- Exportação no iPhone/iPad pela folha de compartilhamento (Web Share API); no Windows, download.
- **Pronto quando:** testes batem com o Python; você importa no Anki do PC e no AnkiMobile (a partir
  da PWA instalada), reimporta e não duplica nem altera o tipo de nota do Kaishi; um Lote de 100
  cartas com áudio é gerado no iPhone sem travar.

### R2 · AnkiConnect pelo navegador ∥ R3 👤

- Página de teste no app que chama `sync`, espera, e lê `findCards`/`cardsInfo`/`notesInfo` nos decks
  日本語::\*. **Nunca `getDeckStats`.** Documentar o `webCorsOriginList` (só a URL de produção e
  `http://localhost:5173`).
- **Pronto quando:** no Chrome do Windows a página lista seus Cards com intervalo, suspensão e leech.

### R3 · Tokenizador e dicionário ∥ R2 👤 (ADR 0004, 0005; zips em `dicts/`)

- Escolher o tokenizador que roda no navegador (kuromoji.js vs. sudachi/lindera wasm: tamanho,
  velocidade, leitura, forma de dicionário). Registrar a escolha no CLAUDE.md.
- Script `tools/` que converte JMdict + JPDB + JmdictFurigana para o formato do app e sobe ao bucket
  `dicts` (logado como você). Protótipo de download + gravação no IndexedDB.
- Metas no iPhone: download ≤ 60 MB (dicionário + tokenizador), preparação ≤ 1 min, consulta ≤ 100 ms.
- **Pronto quando:** números medidos no PC e na PWA do iPhone anotados contra as metas.

### R4 · Casamento texto ↔ Anki (depende de R2 e R3; ADR 0008)

- Tokenizar um EPUB, ligar cada palavra e cada (Word, Word Reading) do Anki a uma entrada do JMdict;
  medir a taxa; contar Cards sem entrada; listar homófonos e palavras só em kana. Testes primeiro.
- **Pronto quando:** taxa anotada e regras ajustadas.

### R5 · Edge Function `gemini` (secret `GEMINI_KEY` já criado; ADR 0009, 0010)

- Função Deno com `action: translate | generate`; aceita só `ALLOWED_USER_ID`; teto diário em
  `gemini_usage`; nomes de modelo em configuração com lista de reserva; cache em `translations`.
- `generate`: um pedido de texto devolve tradução da frase (PT-BR, com a frase anterior e a seguinte
  como contexto) e significado curto da palavra em português; TTS voz Orus com a leitura como
  instrução de pronúncia; PCM → WAV com cabeçalho e corte de silêncio; nome
  `leituras-<sha1(voz|texto)[:12]>.wav`; trava `gerando`; 3 tentativas; estado `erro` com motivo.
- 👤 Alerta de orçamento no Google Cloud; confirmar que a chave é do projeto pago.
- Script que gera 30 cartas; medir tamanho médio do áudio, tokens e custo.
- **Pronto quando:** você ouviu/leu as 30 e anotou o veredito (inclusive a instrução de pronúncia);
  estimativa de storage e custo anotada; chamada com outro usuário é recusada.

## 1. v1

### V1.1 · Sincronização do ttu pelo Supabase (ADR 0001, 0002)

- Novo handler em apps/web/src/lib/data/storage/handler no padrão dos existentes: books (id = hash do
  EPUB; processado + original no bucket), bookmarks (Marcador e Alcance), reading_stats (por livro +
  dia + aparelho), reading_goals. LWW pelo horário do aparelho + soft delete. Audiobook e legendas
  como no-op.
- Marcador sobe a cada ~15 s e ao ir para segundo plano; ao abrir, pergunta se quer ir para o
  marcador mais novo de outro aparelho.
- Aparelho novo: baixa lista, capas, marcadores, estatísticas e metas; livro só ao abrir (ícone de
  nuvem); `storage.persist()`.
- Apagar livro: some em todos os aparelhos, arquivos do bucket apagados, aviso na confirmação.
- **Pronto quando:** livro importado no PC aparece no iPad no mesmo ponto de leitura; ler o mesmo
  livro no mesmo dia em dois aparelhos soma o tempo.

### V1.2 · Dicionário embutido (a partir de R3; ADR 0004, 0005)

- Download do dicionário preparado no primeiro toque (com aviso de tamanho), cache versionado fora
  de `static/`; versão e data nas configurações.
- Busca por forma de dicionário com deflexão pelo tokenizador e regras de reserva; testes primeiro com
  ~100 formas conjugadas tiradas dos EPUBs reais; frequência JPDB; JmdictFurigana.
- **Pronto quando:** testes de deflexão passam; consulta ≤ 100 ms no iPhone.

### V1.3 · Toque na palavra e painel (usa D1; ADR 0003)

- Seleção híbrida (tokenizador para o começo, dicionário para o fim), setas ‹ ›, área de toque grande,
  em qualquer modo de leitura. Regra dos toques do ESCOPO.
- Painel inferior (lateral no iPad/PC): palavra, leitura, glosa EN, entradas por frequência (a que bate
  com o furigana do EPUB primeiro), "não está no dicionário", "Traduzir frase" (R5 + cache, desativado
  offline), "Criar carta" (preenche a parte local e grava em batch_items como pendente).
- Frase: regra do ESCOPO ("Cards"), sem furigana do EPUB.
- Barra verde de parágrafos lidos pelo Alcance; "desmarcar a partir daqui".
- **Pronto quando:** teste de 30 toques no iPhone e no modo do PC com poucas seleções erradas (anotar).

### V1.4 · Tela inicial e navegação ∥ V1.5 (usa D1)

- Navegação inferior (Início, Biblioteca, Fila; Vocabulário oculto até v2), calendário da semana,
  meta, abas tempo/caracteres somando as linhas de cada aparelho, gráfico por dia, filtro 7/30/tudo,
  lista por livro.
- **Pronto quando:** números batem com as estatísticas do ttu.

### V1.5 · Fila de cartas ∥ V1.4 (usa D1; ADR 0010)

- Tela da fila com estados pendente/gerando/gerada/erro/exportada; dispara `generate` quando há rede;
  "Tentar de novo"; editar campos, "Texto para a voz" e "Refazer áudio".
- **Pronto quando:** 10 palavras viram cartas geradas e editáveis, com significado em português.

### V1.6 · Exportar .apkg (usa R1)

- "Exportar .apkg" com as geradas ainda não exportadas + mídia, tamanho estimado (aviso acima de 100);
  cria um Lote (data, aparelho); aviso ao baixar o mesmo Lote em outro aparelho; reexportar só
  explícito. Etiquetas `dokusho` e `dokusho::<título>`. Web Share no iOS.
- Áudio apagado do bucket 30 dias depois do Lote baixado.
- **Pronto quando:** as 10 cartas importam no Anki com áudio; reimportar não duplica.

### V1.7 · PWA, deploy e configurações 👤 (você conecta o repo na Vercel e cola as env vars lá)

- Manifest/ícone; service worker **sem skipWaiting automático** e aviso "Nova versão" fora do leitor
  (ADR 0011).
- 👤 Escolher o subdomínio fixo da Vercel; desligar previews; só `main` em produção; URL de redirect
  do Auth no Supabase.
- Configurações: esconder Drive, OneDrive, pasta local, audiobook e legendas; "Baixar backup",
  "Restaurar backup", "último backup: há N dias"; mensagem de servidor pausado.
- 👤 Assim que o deploy estiver no ar, fechar o R1: na PWA instalada no iPhone, abrir `/teste/apkg`,
  "Gerar" (100 cartas) e "Exportar" → Anki na folha de compartilhamento; conferir que não trava,
  importa no AnkiMobile e reimportar não duplica; apagar o deck `日本語::0. Dokusho teste`; anotar em
  PROGRESSO "Testes de risco" › R1 e marcar R1 como feito.
- **Pronto quando:** critério da v1 no ESCOPO ("Roadmap por versão") cumprido de ponta a ponta.

## 2. v2

### V2.1 · Sincronizar Anki e estados (usa R2 e R4; ADR 0007, 0008, 0013)

- Botão "Sincronizar Anki" (só Windows): `sync` do AnkiWeb antes, leitura completa dos decks, cálculo
  de estado com testes primeiro (incluindo leech), upsert em vocab, soft delete do que sumiu, retrato em
  vocab_history, data da última sincronização, Lote confirmado no Anki.

### V2.2 · Destaque no texto, "Já sei" e aviso na fila

- Destaque por estado (sem gramática); botão "Já sei"; importação inicial por frequência JPDB; aviso
  ao criar carta de palavra já no Anki; "na fila" / "exportada em" no painel; "no Anki como <leitura>"
  quando o Card da entrada tem outra leitura; "Já sei" por entrada (ADR 0013).

### V2.3 · Cobertura por livro e lista de desconhecidas por frequência

### V2.4 · Tela Vocabulário e aba de palavras conhecidas na tela inicial

- **Pronto quando (v2):** critério da v2 no ESCOPO.

## 3. v3 (opcional, um chat por item)

- V3.1 Furigana gerado e furigana adaptativo
- V3.2 Estatísticas cruzando leitura e vocabulário, com palavras vistas
- V3.3 Exportar CSV de conhecidas e aprendendo
