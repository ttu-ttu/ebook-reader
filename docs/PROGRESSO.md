# Progresso

Atualize ao fim de cada chat. Curto: o próximo chat lê isto primeiro.

## Estado

| Item      | Status   | Data       | Observação                                                                  |
| --------- | -------- | ---------- | --------------------------------------------------------------------------- |
| S1        | feito    | 2026-10-20 | ttu roda; vitest; supabase init + link                                      |
| S2        | quase    | 2026-10-20 | schema aplicado, login ok; falta conta + cadastro desligado (👤)            |
| D1        | feito    | 2026-10-20 | telas aprovadas; regra dos toques B; protótipo no branch prototype/d1-telas |
| R1        | quase    | 2026-10-20 | guid e .apkg batem com o genanki; Anki do PC ok; falta AnkiMobile e iPhone  |
| R2        | feito    | 2026-10-20 | Chrome lê 1514 Cards pelo AnkiConnect; falta repetir pela Vercel no V1.7    |
| R3        | quase    | 2026-10-20 | lindera; 32 MB; PC pelo bucket dentro das metas; falta iPhone (👤)          |
| R4        | feito    | 2026-10-20 | 97,5% do texto acha entrada; 0 Cards sem entrada; regras ajustadas          |
| R5        | feito    | 2026-10-21 | 30 cartas aprovadas; US$ 0,0038/carta; 31 MB/100 cartas; falta alerta (👤)  |
| V1.1      | feito    | 2026-10-21 | sincronização por linha (ADR 0014); falta o teste em dois aparelhos (👤)    |
| V1.2      | feito    | 2026-10-21 | 103/103 formas com o JMdict inteiro; falta medir no iPhone (👤)             |
| V1.3      | feito    | 2026-10-21 | toque, painel, carta local, barra verde; falta o teste de 30 toques (👤)    |
| V1.4–V1.7 | pendente |            |                                                                             |
| V2.1–V2.4 | pendente |            |                                                                             |

## Decisões tomadas durante a construção

- 2026-10-15: backend trocado de Appwrite para Supabase (projeto já criado). ESCOPO atualizado.
- 2026-10-15: dicionários num bucket privado `dicts` do Supabase (não no git nem no site público).
- 2026-10-15: hospedagem na Vercel. Secret do Gemini se chama `GEMINI_KEY` (na verdade foi criado como `GEMINI_API_KEY`; ver R5).
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
- 2026-10-20: R1. Port em `apps/web/src/lib/functions/anki/`: `guidFor` (guid.ts), constantes do
  CARDS.md (modelo.ts), `gerarApkg(SQL, { notas, midias, timestamp })` (apkg.ts), `entregarArquivo`
  (Web Share se `canShare` aceita o arquivo, senão download). O guid é calculado dentro do `gerarApkg`
  pela Word e Word Reading (ADR 0006). Referência: `tools/genanki_referencia.py` (genanki 0.13.1, venv em
  `tools/.venv` com **Python 3.14**: o pyyaml não compila no 3.15) grava `genanki-referencia.json`, que
  os testes comparam linha a linha (col, notes, cards, media, schema). sql.js 1.15.1 carregado por
  import dinâmico (wasm de 685 KB, entra no cache do service worker). Zip sem compressão na mídia.
  Notas e cards usam `mod = timestamp` da geração: reimportar o mesmo arquivo não altera nada.
  O Safari só aceita `navigator.share` logo após um toque: gerar o arquivo antes e compartilhar num
  segundo toque (vale para o V1.6). `resolveJsonModule` ligado no tsconfig. Página provisória
  `/teste/apkg` (apagar no V1.6) gera um Lote falso com WAV sintético, no deck `日本語::0. Dokusho teste`
  por padrão (opção `deck` do `gerarApkg`, só para testes).
- 2026-10-20: R2. Cliente em `apps/web/src/lib/functions/anki/anki-connect.ts`
  (`criarAnkiConnect({ url, fetch })`): lista fixa de ações (`version`, `sync`, `deckNamesAndIds`,
  `findCards`, `cardsInfo`, `notesInfo`); qualquer outra, `getDeckStats` inclusive, é recusada antes
  do `fetch`. URL padrão `http://127.0.0.1:8765`. `buscarCards(raiz)` faz `findCards "deck:日本語"`
  (pega os subdecks) e `cardsInfo` + `notesInfo` em lotes de 200; `leech` vem das etiquetas da nota,
  suspenso é `queue = -1`, intervalo negativo é segundos. Tipo de nota sem `Word` usa o primeiro
  campo. Erros com `tipo`: `rede` (Anki fechado, CORS ou rede local: o navegador não diferencia),
  `tempo`, `anki`, `acao-proibida`. `sync` com limite de 5 min, incluindo a espera da coleção. Configuração e regras em
  docs/ANKI-CONNECT.md. Página provisória `/teste/anki` (apagar no V2.1).
- 2026-10-20: R3. Tokenizador `lindera-wasm-ipadic` 2.1.0 (ADR 0012; bancada contra o kuromoji no
  ADR). Wrapper em `apps/web/src/lib/data/dicionario/tokenizador.ts` (`Pedaco`: superfície, base,
  leitura em hiragana, classe, início). Init do wasm **assíncrono** (o Chrome recusa compilar wasm
  > 8 MB de forma síncrona na thread principal). O wasm sai como asset do Vite
  > (`_app/immutable/assets/lindera_wasm_ipadic_bg.<hash>.wasm`); o service worker o tira do cache de
  > build e não apaga caches `dokusho-*`; o app o guarda no cache `dokusho-tokenizador`.
  > `optimizeDeps.exclude` no vite.config. Dicionário: `formato.ts` (tipos + conversor, sem imports para
  > o Node rodar o .ts direto) e `tools/preparar-dicionario.ts` → `dicts/saida/<versao>/` com
  > `dicionario.ndjson.gz` e `manifesto.json`; versão `jmdict-<data>-f<FORMATO>`. Cada entrada é um
  > `seq` do JMdict com formas (escrita, leitura, `f` = JPDB da escrita, `fk` = JPDB da palavra em kana,
  > `fu` = furigana só quando não cobre a palavra inteira) e sentidos (etiquetas + glosas EN; notas,
  > referências e tabelas de formas ficam fora). Entradas ordenadas pela leitura (homófonos no mesmo
  > bloco), blocos de 64; índice termo → ids em blocos de 512 termos ordenados, limites no cabeçalho,
  > busca binária (serve para a busca por prefixo da seleção híbrida). No IndexedDB
  > (`dokusho-dicionario`, separado do books-db) os blocos ficam como texto JSON; a versão só é
  > gravada no fim (gravação interrompida recomeça). `tools/subir-dicionario.ts` sobe para
  > `dicts/<user_id>/dicionario/<versao>/` e grava `<user_id>/dicionario/atual.json` (cache 0), que o
  > app lê para saber a versão. JmdictFurigana 2.3.1+2026-09-25 baixado em `dicts/`. `tools/` fora do
  > eslint (fora do tsconfig dele); `tools/package.json` com `"type": "module"`. Página provisória
  > `/teste/dicionario` (apagar no V1.2), com opção de preparar um arquivo local sem login.
- 2026-10-20: R4. Casamento em `apps/web/src/lib/data/vocabulario/casamento.ts` (funções puras com
  `consultar` injetado). Palavra do hub = `{ seq, leitura }` (`chavePalavra` = `seq|leitura`, leitura em
  hiragana). `casarCard(consultar, Word, Word Reading)`: limpa HTML e `〜`, separa leituras por `・`/`、`
  (uma Palavra por leitura); liga as entradas com a escrita do Card e a leitura; Card só em kana (ou sem
  entrada com a escrita) liga também a mais frequente com a leitura, que é a que o texto escolhe
  (なる → 成る). `casarPedaco(consultar, pedaco)`: `null` para gramática (`ehGramatica`: 助詞, 助動詞,
  記号, 接頭詞, フィラー, その他, qualquer 非自立, 動詞 接尾 como せる/れる, e o que não tem kana nem
  kanji; 名詞 接尾 como さん conta); consulta a forma de dicionário, depois o verbo de origem do
  potencial (会える → 会う: o IPADIC dá o potencial como verbo e o JMdict não tem), depois a superfície;
  desempata pela leitura (no conjugado, pelo radical: 行っ いっ → いく, não ゆく) e, sem desempate, fica
  a mais frequente (`candidatas` traz as outras). `Pedaco` ganhou `subclasse` (detalhes[1] do IPADIC).
  `ordenarPorFrequencia` exportado do banco.ts. Medição em `casamento.medicao.test.ts` (pulada sem
  `MEDIR_CASAMENTO`; lê `dicts/saida/`, o EPUB e o AnkiConnect pelo Node, sem CORS).
- 2026-10-20: ADR 0013 (substitui a leitura do ADR 0008): texto e Anki casam pela entrada (seq) com
  qualquer leitura; a leitura só escolhe a entrada no texto. `indexarAnki(palavras)` → seq → leituras do
  Anki; `noAnki(indice, palavra)` → `{ leituras, outraLeitura }` ou undefined. O painel do V2.2 mostra
  "no Anki como <leitura>" quando `outraLeitura`; "Já sei" vale para a entrada (V2.2).
- 2026-10-20: o servidor do Vite manda `.gz` com `Content-Encoding: gzip` e o navegador já entrega
  descompactado; `prepararArquivo` olha os bytes mágicos antes de descompactar.
- 2026-10-20: o `pnpm dev` de outro chat na mesma pasta ocupa a 5173 e o novo sobe na 5174, que não
  está no `webCorsOriginList`. Para o R2, rodar o dev só na 5173.
- 2026-10-20: R5. Edge Function em `supabase/functions/gemini/`; lógica pura sem imports (`wav.ts`,
  `textos.ts`, `modelos.ts`, testada pelo vitest, que agora inclui `supabase/functions/**/*.test.ts`) e
  `index.ts` (Deno). Deploy com `--use-api` (sem Docker nem Deno no PC). O secret da chave é
  **`GEMINI_API_KEY`** (foi criado assim em 15/10; docs corrigidos). Configuração em secrets:
  `GEMINI_MODELOS_TEXTO=gemini-3.8-flash,gemini-3.5-flash-lite`,
  `GEMINI_MODELOS_TTS=gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts` (os 2.5 só servem a quem já usava),
  `GEMINI_TETO_DIARIO=300`. API `generateContent` (a Interactions é a recomendada, mas o
  generateContent "remains fully supported"); o TTS pode vir como PCM cru ou WAV, `extrairPcm` aceita os dois.
  Migração `20261020180000_gemini.sql`: `sentence_before`/`sentence_after` em `batch_items` (contexto que
  o aparelho grava na parte local, V1.3); RPCs `gemini_reservar` (teto atômico, dia UTC) e `gemini_travar`
  (pendente/erro → gerando; trava com mais de 5 min é retomada), só para `service_role`. Cada chamada
  HTTP ao Gemini (inclusive tentativa e reserva) conta no teto. `generate` faz só o que falta (num "Tentar
  de novo" o que deu certo fica) e aceita `refazer: [texto | audio]` para o "Refazer áudio" do V1.5;
  reaproveita a tradução de `translations` e grava a sua lá. Erro de modelo (404, 429, 5xx, rede) passa
  para o de reserva; 3 rodadas com espera de 2 s e 6 s; 400/401/403 e teto param na hora. Áudio em
  `audio/<user_id>/leituras-<hash>.wav`; o hash da palavra inclui a instrução com a leitura. Instrução de
  pronúncia (em inglês, como nos exemplos do Google): `Say this Japanese word, pronounced 「<leitura>」: <palavra>`.
  Resposta do `generate`: `{ estado, motivo?, campos, medidas }` (409 `ocupada` se outra chamada gera).

- 2026-10-21: V1.1 (autônomo, revisar). **ADR 0014**: a sincronização não é um handler do ttu (eles
  copiam arquivos, pelo título, num gesto manual); é o módulo `lib/data/supabase/sincronizacao/`, que lê
  e grava o IndexedDB do ttu direto e troca linhas com o Supabase. `sincronizador.ts` (motor, testado com
  um servidor falso e dois aparelhos), `regras.ts` (LWW, Alcance, conversões), `banco.ts` (IndexedDB
  `dokusho-sinc`: título → hash, enviados, cursores, EPUB até subir, Alcance, estatísticas dos outros
  aparelhos, marcador remoto pendente), `servidor-supabase.ts`, `iniciar.ts` (gatilhos). Cada rodada
  recebe (cursor `updated_at`, páginas por posição) e depois envia o que mudou desde o último envio.
  Gatilhos: ao abrir o app, ao voltar a rede, ao trocar de plano (ida e volta), a cada 5 min em primeiro
  plano e ~15 s depois de uma mudança no banco do ttu (`database.mudou$`, novo). Migração
  `20261021120000_sincronizacao.sql`: `bookmarks.device_id/device_name`, `books.processed_size`,
  `reading_goals.goal_frequency`.
  Livro: hash SHA-256 do EPUB calculado na importação (antes de gravar no ttu); livros sem EPUB (de antes
  do V1.1, TXT, HTMLZ) usam o hash do texto processado e sobem sem original. No bucket `epubs`:
  `<user_id>/<hash>/processado.zip` (mesmo desenho do zip do ttu), `original.epub`, `capa`. No aparelho
  novo o livro vira um placeholder do ttu (sem texto, com capa) com ícone de nuvem; tocar baixa o
  processado com progresso. Dois livros com o mesmo título continuam impossíveis no mesmo aparelho (o
  ttu indexa pelo título); o segundo não desce.
  Marcador: sobe com Alcance (máximo pela leitura; um "desmarcar" mais novo vence), aparelho e nome. Ao
  abrir o livro, o leitor espera até 4 s pela sincronização; se outro aparelho tem marcador mais novo,
  pergunta "Você parou no iPad, cap. 3 (42%). Ir para lá?" (Ficar aqui / Ir para lá). Aparelho sem
  marcador recebe direto.
  Estatísticas: as do ttu são só deste aparelho (`device_id` aleatório no localStorage); as dos outros
  ficam em `dokusho-sinc` para a tela inicial somar (V1.4). Estatística apagada aqui é apagada no
  servidor. Aparelho que perdeu o banco recebe de volta as próprias. Metas: por `goal_start_date`, LWW.
  Apagar livro: confirmação ("some de todos os aparelhos… estatísticas e cartas ficam"), soft delete do
  livro e do marcador, arquivos do bucket apagados; reimportar depois devolve o livro.
  Padrões mudados no ttu: estatísticas ligadas e livros "placeholder" visíveis. `ConfirmDialog` aceita
  rótulos. Sem login, nada é sincronizado (o app segue local).
- 2026-10-21: V1.2 (autônomo, revisar). Busca em `lib/data/dicionario/busca.ts`: o toque escolhe o
  pedaço do tokenizador (começo); o fim é o trecho mais longo (até 6 pedaços, 14 caracteres, sem
  atravessar pontuação ou espaço) cujo termo "pedaços inteiros + forma de dicionário do último" está
  no dicionário; depois a superfície e as reservas (verbo do potencial, sem alongamento すごーい, sem っ
  final, katakana → hiragana). **Regra nova**: um trecho que só acrescenta flexão ao verbo ou adjetivo
  (auxiliar, て/で, verbo sufixo, verbo auxiliar depois de て) não vale, mesmo que o JMdict tenha a
  expressão (知らず, 急いで, 信じられない, 持ってくる, 呼ばれる): a palavra a estudar é o verbo; a seta ›
  alcança a expressão. Verbo composto (読み|終わる) continua inteiro. A seleção cobre a forma conjugada
  (立ち止まった, 食べさせられたくなかった), que vai em `<b>` na Frase. Setas: ‹ encurta e › alonga o
  fim em um pedaço; o começo é sempre o do pedaço tocado. Casos em `busca.casos.ts` (103 frases no
  estilo dos romances; o EPUB do R4 não está no repositório): 103/103 com um dicionário mínimo e com o
  JMdict inteiro (`busca.medicao.test.ts`, `MEDIR_DEFLEXAO=1`), busca no toque com mediana 0,08 ms e
  máximo 2,5 ms no Node. Lexicalizadas aceitas: 眠れる (o JMdict tem; o IPADIC dá o potencial como
  verbo), すごーい e カワイイ (formas do JMdict). O casamento do R4 usa as mesmas regras (potencial e
  gramática). `banco.ts` guarda na memória os últimos 64 blocos de índice e de entradas.
  `servico.ts`: estado do dicionário, `pedirDicionario()` (diálogo com o tamanho: dicionário + 18 MB do
  tokenizador se ainda não está no cache), `consultarPalavra` com as últimas 500 respostas,
  `medirConsultas()`. Configurações › Data › Dicionário: versão, data da versão, data do download,
  Baixar/Atualizar (compara com `atual.json`), Apagar deste aparelho, Medir velocidade (substitui a
  `/teste/dicionario`, que saiu). `dialog-template.svelte` ganhou `<script lang="ts">`: `pnpm check`
  caiu de 27 para **15** erros, todos antigos do ttu.
- 2026-10-21: V1.3 (autônomo, revisar). `lib/components/painel-palavra/`: `leitor-dokusho.svelte`
  (entra no leitor do ttu ao lado do BookReader) escuta o clique na janela; `caractereNoPonto`
  (caretRangeFromPoint/caretPositionFromPoint, 6 px de folga) acha o caractere; o parágrafo (p, h\*,
  li…) vira texto sem `<rt>` com o mapa de volta aos nós e os `<ruby>`; o tokenizador corta o
  parágrafo (guardado por parágrafo) e `selecionar` (V1.2) escolhe a palavra. Realce pela CSS Custom
  Highlight API (`::highlight(dokusho-selecao)`; Safari 17.2+); sem ela, sem realce. Regra B: palavra
  abre ou troca o painel; pontuação, margem ou fora do texto só fecham; arrastar a alça fecha. O
  primeiro toque sem dicionário abre o aviso de download (V1.2). Painel (`painel-palavra.svelte`, no
  desenho do D1): inferior até 767 px; na tela larga, lateral (360 px) **do lado oposto ao da palavra
  tocada** (com texto vertical o começo fica à direita). Mostra leitura e escrita da entrada aberta,
  "seleção: X → Y", entradas pela frequência (a que bate com o `<ruby>` do EPUB ou com a leitura do
  tokenizador primeiro, marcada "furigana do livro"), até 6 sentidos com etiquetas, JPDB, "não está no
  dicionário", "gramática · fora da cobertura", "Traduzir frase" (cache local de `translations`,
  depois a ação `translate`; desativado offline), "Na fila · <estado>" ou "Exportada em <data>",
  "Já sei" desativado (v2), "Criar carta" (ou "Na fila · abrir", que vai para `/fila?carta=<id>`);
  carta já exportada pede "Criar mesmo assim". Setas: ‹ e › mexem só no fim, por pedaço.
  Carta (`lib/data/cartas/palavra.ts`, `frase.ts`, `furigana.ts`): Word é a escrita da entrada (texto
  em kana pega a escrita mais frequente com a leitura: わかる → 分かる; entrada "uk" do JMdict fica em
  kana); Word Furigana pelo JmdictFurigana ou pelo alinhamento do okurigana (立[た]ち 止[ど]まる);
  Frase pelo ESCOPO (。！？ fora de 「」, corte em ~150 caracteres num 、 com "…"); Sentence com `<b>` na
  forma conjugada; Sentence Furigana pelos pedaços do tokenizador, com JmdictFurigana quando a escrita
  e a leitura batem; contexto (frase anterior e seguinte, inclusive dos parágrafos vizinhos); Frequency;
  `jmdict_id`; `book_id` = hash do livro. Gravada como `pendente` no `dokusho-sinc` (lojas novas
  `cartas`, `lotes`, `traducoes`, banco v2) e sincronizada por linha com `batch_items`/`lotes`
  (`translations` só desce). Barra do topo: no modo contínuo aparece ao rolar para trás (para cima, ou
  para a direita no vertical) e some ao avançar; no modo de páginas e no começo do capítulo vale a
  faixa do topo do ttu (32 px), que já existia. Barra verde: `alcance-dom.ts` conta o fim de cada
  parágrafo como o ttu conta o marcador, no HTML inteiro do livro (por seção, para o modo de páginas);
  `::before` com propriedades lógicas (à esquerda no horizontal, em cima no vertical), sem mudar o
  layout. O Alcance sobe com o `exploredCharCount`; "Desmarcar a partir daqui" é um ícone de borracha
  na barra do leitor (baixa o Alcance para o ponto atual e grava o marcador, que leva o Alcance aos
  outros aparelhos). Testado no painel do navegador com o dicionário local e um EPUB de teste
  (substituindo o `requestAnimationFrame`, que não roda com a janela oculta): 食べた → 食べる,
  気がついた → 気がつく, 漢字 com o furigana do livro, setas, pontuação fechando, carta gravada como o
  CARDS.md pede.
- 2026-10-21: o leitor não desenha o texto no painel do navegador do Claude quando a janela está oculta
  (o livro está no IndexedDB, mas a página não pinta). Teste visual do leitor fica para o Igor.

## Testes de risco

### R1 · guid e .apkg (2026-10-20)

- guid: 12 casos (開く あく/ひらく, 止める, 方, kana, acentos, um valor só) iguais ao genanki. ✅
- .apkg: mesmas linhas de `col`, `notes` e `cards`, mesmo `media` e mesmos arquivos que o genanki. ✅
- PC (Chrome, dev): Lote de 100 cartas com 1 s + 4 s de áudio: sql.js 0,3 s, .apkg 3,3 s, 22,9 MB.
  Áudio real deve ser menor (silêncio cortado); medir de novo no R5.
- Anki do PC (2026-10-20): Lote de 100 importado; reimportar não duplica nem atualiza notas; tipos de
  nota só "Kaishi 1.5k" e "Leituras (estilo Kaishi)" (sem cópia); frente, verso e os dois áudios ok. ✅
- 👤 Falta: AnkiMobile e o Lote de 100 no iPhone a partir da PWA (precisa de HTTPS: Vercel ligada).

### R2 · AnkiConnect pelo navegador (2026-10-20)

- Cliente: 7 testes com `fetch` simulado (lista de ações, erros, lotes, etiquetas, leech). ✅
- `/teste/anki` no Chrome sem o Anki ouvindo: mostra o erro `rede`. ✅
- Chrome do Windows, `http://localhost:5173` no `webCorsOriginList`: CORS ok, `version` e `sync` ok. ✅
- Primeira rodada falhou logo depois do `sync`: "Collection lifecycle operation is active" (o Anki
  roda a sincronização da interface depois do `sync`). Corrigido: o cliente repete `deckNamesAndIds`
  a cada 0,5 s até a coleção liberar. ✅
- Leitura: 1514 Cards (`2. Kaishi 1.5k` 1500, `3. Old` 14, `1. Dokusho` 0, `日本語` 0); 71
  suspensos, 0 leech, 245 novos, 932 com intervalo ≥ 21 d. Intervalo e suspensão aparecem certos. ✅
- Leech: nenhum Card real tem a etiqueta; o caminho só está coberto pelo teste unitário.
- Para o R4: o Kaishi tem Word Reading com mais de uma leitura no mesmo campo (何 → `なに・なん`);
  o casamento pela entrada do JMdict precisa separar por `・`.
- Falta (V1.7): pôr a URL de produção no `webCorsOriginList` e repetir pela Vercel, com o prompt de
  rede local do Chrome.

### R3 · Tokenizador e dicionário (2026-10-20)

- Tokenizador: kuromoji.js e lindera (IPADIC nos dois) cortam igual; lindera carrega em 1,1 s contra
  3,6 s, tokeniza 10× mais rápido e usa 137 MB contra 320 MB (Node). Escolha no ADR 0012. ✅
- Dicionário: 218.914 entradas do JMdict, 67,1 MB de texto → **15,9 MB** gzip; conversão no PC em ~50 s.
- Download total: 15,9 MB (dicionário) + 16,5 MB (wasm em gzip; 18,0 MB sem compressão) ≈ **32 MB**
  ≤ 60 MB. ✅ Não conferido se a Vercel comprime o `.wasm`; se não comprimir, são 34 MB.
- PC (Chrome, dev): preparação (descompactar + IndexedDB) **5,6 s** ≤ 1 min ✅; tokenizador pronto em
  1,0 s a partir do cache; 77 consultas pela forma de dicionário de um texto de amostra: média 5 ms,
  p95 10 ms, máx 61–68 ms (a primeira consulta, com o cache frio) ≤ 100 ms ✅. 77/77 acharam entrada.
- Primeira versão media 33 s de preparação: 107 mil registros no IndexedDB (índice com chave de 2
  caracteres). Índice em blocos ordenados: 4,3 mil registros. Blocos de 256 entradas espalhavam
  homófonos (こう: 51 entradas em 34 blocos, 100 ms); ordenar pela leitura + blocos de 64 resolveu.
- PC pelo bucket (Chrome, dev, logado; 2026-10-20): `atual.json` lido; download 15,9 MB em 2,4 s;
  preparação 3,2 s; tokenizador 18,0 MB da rede, pronto em 2,8 s; 77 consultas: média 6 ms, p95 12 ms,
  máx 29–40 ms, 77/77 com entrada; espaço do site 33 MB. ✅
- Falta (👤): medir na PWA do iPhone (depois da Vercel, V1.7). No iPhone, atenção à memória: wasm
  (~140 MB no Node) + IndexedDB.

### R4 · Casamento texto ↔ Anki (2026-10-20)

- Rodar (em apps/web, Anki aberto): `$env:MEDIR_CASAMENTO="<livro.epub>"; npx vitest run casamento.medicao`
  (`MEDIR_SAIDA=<arquivo.json>` grava as listas completas). ~40 s no PC.
- Livro: また、同じ夢を見ていた (152 mil caracteres, 86.947 pedaços; 53.616 de gramática, 33.331 de
  conteúdo). Testes de regra: 23 em `casamento.test.ts`. ✅
- Texto → JMdict: **97,5%** dos pedaços de conteúdo acham entrada; 2,5% sem entrada, quase tudo nome
  próprio (桐生 ×455, 荻原, 小柳, なっちゃん), onomatopeia e grafia mista (立ちあがる, 生みだす). ✅
- Anki → JMdict: 1514 Cards, 1502 pares (Word, Word Reading), **0 sem entrada**; 17 ambíguos (mesma
  escrita e leitura em 2+ entradas: これ, それ, 三 さん, 妻, パン…), ligados a todas. ✅
- Texto ↔ Anki: 3021 Palavras distintas no livro; **1086 (36%) caem num Card**, 24.442 ocorrências
  (73% dos pedaços de conteúdo). Pela escrita seriam 1068: o JMdict ganha 48 (ない = 無い ×203, なん = 何,
  子ども = 子供, たくさん = 沢山, かける = 掛ける, 走れる = 走る…) e perde 30, quase todas sufixo ou
  contador com outra leitura e outra entrada (人 にん ×71, 日 にち, 中 ちゅう, 後 ご), que de fato são
  outra entrada do JMdict.
- Só em kana: 36% dos pedaços casados; 177 Palavras só em kana caem num Card.
- Homófonos em kana: 22,6% dos pedaços casados têm mais de uma entrada candidata e ficam com a mais
  frequente. Em 22 Palavras outra candidata está no Anki (さ → 差, え → 絵, いや → 嫌, こ → 子): quase
  sempre a escolhida está certa (interjeição, pedaço de palavra); não usar "qualquer candidata".
  Erro conhecido: なれる (potencial de なる) cai em 慣れる.
- Primeira rodada (antes dos ajustes): Card em kana ligava todas as entradas da leitura (さん → 12,
  incluindo 三; こう → 51); só pela escrita, なる ×347 deixava de casar (o texto escolhe 成る). Potencial
  (会える, 書ける) sem entrada; お ×475 e せる (de させる) ×73 contavam como palavra.
- 16 Palavras (171 ocorrências) caem na mesma entrada de um Card com **outra leitura**:
  皆 みな × みんな ×66, じゃあ × じゃ ×40, こっち × こちら, とっても × とても, どっち, あんまり,
  入り口 いりくち (leitura errada do IPADIC), 日本 にっぽん, 一言 いちげん (idem). Quase todas são a mesma
  palavra; falsas: しかして × そして, せる × 迫る (×1). Decidido no ADR 0013: casa pela entrada com
  qualquer leitura. Com ele: **1102 Palavras** do livro no Anki (1086 pela regra antiga), 24.613
  ocorrências (73,8% do conteúdo); pela escrita seriam 1068 (JMdict ganha 60, perde 26).

### R5 · Edge Function `gemini` (2026-10-20)

- Testes de regra: 41 (WAV, corte de silêncio, nomes, pedidos, reserva, acesso, conferência, cadeia). ✅
- Primeira rodada das 30: todas recusadas pelo gateway. Os tokens do Auth são ES256 (chaves de
  assinatura novas) e o `verify_jwt` do gateway só aceita os antigos (HS256). Corrigido:
  `verify_jwt = false` em `[functions.gemini]` do config.toml; a função confere o login com
  `auth.getUser`. Toda função nova deste projeto precisa do mesmo.
- Recusa (chamada real, depois da correção): sem token, chave pública sem usuário e JWT falso → 401
  `sem login` da própria função. A recusa de outro usuário logado (403) só pelo teste unitário: o cadastro está desligado. ✅
- 30 cartas: `dicts/r5/cartas.json` (fora do git) com palavras do また、同じ夢を見ていた, várias de leitura
  ambígua (辛い つらい, 開く あく, 風 ふう, 上手い うまい, 一日 いちにち, 明日 あした, 何度, 下手 へた).
  Preços de `dicts/r5/precos.json` (US$/1M tokens, tabela de out/2026).
- Rodada 1 (2026-10-21, voz da palavra com a instrução no texto): 30/30 geradas, 14 s por carta. A voz da
  palavra **lia a instrução em inglês** ("Say this Japanese word, pronounced...", ~4 s, 190 KB). Vozes das
  frases ótimas (6,0 s e 282 KB em média). Texto: US$ 0,0024 por carta (765 tokens); voz da frase US$ 0,0014.
  Muitas chamadas caíram no modelo de reserva `flash-lite-tts` (limite de frequência do principal).
- Comparação da voz da palavra (20 palavras: 11 de leitura ambígua do livro + 橋/箸/端, 雨/飴, 神/紙, 柿/牡蠣;
  conferência = o modelo de texto ouve e escreve em hiragana):
  kanji puro 14/20 (方, 橋, 端, 神, 風 **lidos em chinês**: fang, qiao, duan, shen, feng);
  kanji + dica de leitura na anotação de estilo (API Interactions) 17/20 (ignorou a dica em 方 かた,
  明日 あす, 風 ふ; nunca chinês); só kana 18/20 (風 e 橋 provavelmente erro da conferência). No ouvido do
  Igor, a dica muda o acento entre os pares e parece certo; a kana não tem como saber o acento.
  ~0,6 s e ~30 KB por voz de palavra.
- Decisão (custo-benefício): cadeia dica → conferência → kana → marca `confira` (`word_audio_check`).
  Voz da palavra: US$ 0,00064 por carta (só kana: 0,00022); total ~US$ 0,0045 por carta (+10%), ~US$ 2,7/mês
  a 20 cartas/dia. ~4,3 chamadas por carta: teto de 300 ≈ 70 cartas/dia. Storage: ~31 MB por 100 cartas.
- Para o V1.5: mostrar a marca `confira` na fila (ouvir, "Texto para a voz", "Refazer áudio";
  `refazer: [audio]` limpa a marca). Para o V1.6: o .apkg de 100 cartas fica perto de 31 MB.
- Rodada final (2026-10-21, com a cadeia; 11 cartas de uma rodada que bateu no teto + 19 com
  `--continuar`): 30/30 geradas. Voz da palavra: **dica 27, kana 3, confira 0** (a dica errou 方 → ほ,
  風 → かぜ, 寂しい → さみしい; a kana acertou as três). Áudio: palavra 36 KB (0,8 s), frase 279 KB (5,9 s);
  **30,7 MB por 100 cartas**. Tokens: texto 671, voz da palavra 203 (com a conferência), voz da frase 180.
  **US$ 0,00375 por carta** (US$ 0,38 por 100). 16 s por carta. Veredito do Igor: significados,
  traduções e vozes bons ("não acho que dê para ficar melhor"). ✅
- Teto: subiu para 2000 só durante os testes; de volta a 300.

## Pendências do usuário

- [x] docs/CARDS.md
- [x] apps/web/.env com URL e anon key
- [x] Dicionários em dicts/ (JMdict_english, JPDB v2.2 Frequency Kana)
- [x] Secret GEMINI_API_KEY no Supabase
- [x] Hospedagem: Vercel
- [ ] Conectar o repo na Vercel e cadastrar as env vars (V1.7)
- [x] Criar a conta, entrar em `/login` e desligar o cadastro (S2)
- [ ] Colar `supabase/tests/rls_check.sql` no SQL Editor e conferir dono = 1, outro = 0 (S2)
- [x] R1: importar o Lote de teste no Anki do PC, reimportar e conferir tipos de nota
- [ ] R1: AnkiMobile e Lote de 100 no iPhone pela PWA (depois de ligar a Vercel); apagar o deck de teste (passo a passo no V1.7 do FASES.md)
- [x] R2: rodar `/teste/anki` com o Anki aberto
- [ ] V1.7: pôr a URL de produção no `webCorsOriginList` (docs/ANKI-CONNECT.md)
- [x] R3: na raiz, `node tools/subir-dicionario.ts` (e-mail e senha no terminal); depois, logado no
      app, `/teste/dicionario` → "Baixar dicionário" e anotar download e preparação
- [ ] R3 e V1.2: na PWA do iPhone (depois da Vercel), Configurações › Data › Dicionário: "Baixar"
      (anotar o tempo) e "Medir velocidade"; anotar em "Testes de risco" › R3 e marcar R3 como feito
      (a página `/teste/dicionario` saiu no V1.2)
- [ ] Alerta de orçamento no Google Cloud e confirmar que a GEMINI_API_KEY é do projeto pago (R5)
- [x] R5: rodada final das 30 cartas e veredito
- [ ] Escolher o subdomínio da Vercel e desligar previews (V1.7)
- [ ] V1.1: importar um livro no PC, abrir no iPad no mesmo ponto; ler o mesmo livro no mesmo dia nos
      dois e conferir a soma do tempo (V1.4); apagar um livro e ver sumir no outro
- [ ] V1.3: teste de 30 toques no iPhone (horizontal com rolagem) e no PC (modo que for usar);
      anotar quantas seleções saíram erradas em "Testes de risco"

## Sem decisão (da entrevista de 20/10)

- Modo de leitura no PC (o toque e o painel funcionam nos dois; a barra do topo foi resolvida no V1.3).
- Números: frequência N do "Já sei" inicial, teto diário do Gemini, valor do alerta, corte da frase,
  intervalo do marcador, prazo do áudio.
- Não discutidos: detalhes da tela inicial (início da semana, virada do dia, fuso em viagem), metas,
  desfazer "Já sei", tela Vocabulário, restaurar backup (substituir ou mesclar), fontes e acessibilidade.
