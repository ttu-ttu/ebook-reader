# Entrevista de escopo (2026-10-20)

Registro das decisões da entrevista sobre o escopo inteiro, área por área. No fim, vira a lista de mudanças para o ESCOPO. ADRs em docs/adr/, termos em GLOSSARY.md.

## 1. Usuário e uso real

- Revisão do Anki: quase sempre no PC, às vezes no celular. "Sincronizar Anki" chama primeiro o `sync` do AnkiConnect (PC ↔ AnkiWeb) e só depois lê os cartões.
- Anki do PC aberto quase todo dia; defasagem do hub é aceitável. Data da última sincronização visível.
- Importação do .apkg: em qualquer aparelho, mas cada Lote uma vez só. A fila mostra cada Lote com data e aparelho onde foi baixado; baixar o mesmo Lote em outro aparelho gera aviso. v2: marcar o Lote como "confirmado no Anki" quando a Sincronização do Anki encontrar os cartões.
- EPUBs baixados da internet, sem DRM. DRM fora do escopo.
- Volume: 20 a 50 palavras por semana (~300 KB de WAV por carta).
- Leitura offline ocasional: "Traduzir frase" desativado sem rede (sem fila de traduções); "Virar cartão" funciona offline.

## 2. Dados e sincronização

- Livro identificado pelo hash do EPUB; título só para exibir (ADR 0001).
- Bucket guarda o livro processado (para ler) e o EPUB original (backup) (ADR 0001).
- Marcador sobe a cada ~15 s após virar a página e ao ir para segundo plano. Ao abrir, se outro aparelho tem marcador mais novo, o app pergunta se quer ir para lá (não pula sozinho).
- Estatísticas: uma linha por livro + dia + aparelho; a tela inicial soma as linhas.
- LWW pelo horário do aparelho; `updated_at` do servidor só como cursor (ADR 0002).
- Aparelho novo: baixa automaticamente lista, capas, marcadores, estatísticas, metas, fila e hub; livro baixado ao abrir (ícone de nuvem); dicionário no primeiro toque, com aviso de tamanho; pede `storage.persist()`.
- Apagar livro: some em todos os aparelhos, arquivos do bucket apagados de verdade, estatísticas e cartas ficam. **Mostrar aviso explicando isso na confirmação de apagar.**

## 3. Leitura e toque

- Parágrafos lidos marcados automaticamente (barra verde) pelo Alcance, que nunca volta; opção "desmarcar a partir daqui". Barra na v1; "palavras vistas" na v3.
- Furigana na v1: só o do EPUB (o que o ttu faz). Furigana gerado vai para a v3 junto com o adaptativo.
- Modos: iPhone e iPad horizontal com rolagem; PC provavelmente vertical com páginas (não fixado). O toque não pode depender do modo; o teste dos 30 toques roda nas combinações usadas.
- Toque em palavra abre o painel; toque fora do texto ou no topo mostra a barra; toque fora do painel ou arrastar para baixo fecha; tocar outra palavra troca o conteúdo. **Confirmar ao desenhar as telas.**
- Seleção híbrida: tokenizador define o começo, dicionário define o fim; setas ‹ › no painel para ajustar (ADR 0003).
- Frase: do último 。！？ (ou início do parágrafo) ao próximo, sem cortar dentro de 「」, sem o furigana do EPUB, cortada perto da palavra acima de ~150 caracteres. Tem que sair boa de cara; editável.
- Várias leituras: painel lista as entradas por frequência JPDB; a que bate com o furigana do EPUB vem primeiro; "Virar cartão" usa a entrada aberta.

## 4. Dicionário e tokenizador

- Dicionário preparado no PC por script em `tools/` (Yomitan como entrada) e baixado pronto pelos aparelhos; sem importação Yomitan no aparelho (ADR 0004).
- Metas no iPhone: download ≤ 60 MB, preparação ≤ 1 min, consulta ≤ 100 ms. Plano B: cortar entradas raras.
- Arquivos pesados fora de `static/`: dicionário no IndexedDB, arquivos do tokenizador num cache versionado com nome próprio que o deploy não apaga.
- Deflexão pela forma de dicionário do tokenizador, com regras próprias de reserva; testes com ~100 formas reais (ADR 0005). Muda a regra do CLAUDE.md.
- Word Furigana e furigana da frase pelo JmdictFurigana (CC BY-SA); fora dele, furigana sobre a palavra inteira ou leitura do tokenizador.
- Palavra fora do dicionário (nomes em katakana): painel mostra "não está no dicionário", com Traduzir e Virar cartão ativos; sem JMnedict na v1.
- **Folhas de escrita (kanji conhecidos) saem do escopo**, inclusive da v3 (ESCOPO e FASES V3.1). Sem KANJIDIC.
- Dicionário congelado; atualização manual pelo script; versão visível nas configurações.

## 5. Hub e Anki

- Anki real (20/10): `日本語::1. Dokusho` (14 notas, renomeado pelo Igor), `日本語::2. Kaishi 1.5k` (1.500 notas; 71 suspensas, 0 leeches), `日本語::3. Old` (antigo Mugiwara RPG). Nenhum outro tipo de nota em 日本語. Frequency do Kaishi é só o número do ranking (ex.: `319`).
- O Anki casa o deck pelo **nome** na importação, não pelo ID; o nome exato manda. CARDS.md precisa corrigir: Kaishi é "2.", não "5."; a seção do RPG e o fluxo das conversas saem.
- **Projeto de cards pelas conversas do Claude abandonado.** Só o app gera cards. CARDS.md: remover tarefa agendada, artifact "Áudio das Leituras", deck rpg; o script vira só referência de formato.
- guid = `guid_for("leituras-igor", palavra, leitura)` (ADR 0006).
- Cada carta exportada uma vez; "Exportar" só inclui geradas não exportadas; reexportar é ação explícita com aviso de sobrescrever o Anki.
- Suspenso sem etiqueta `leech` = conhecida; leech suspenso = aprendendo.
- Botão "Já sei" no painel + gramática fora da cobertura + importação inicial por frequência JPDB (ADR 0007).
- Casamento pela entrada do JMdict (ADR 0008).
- Palavra apagada do Anki volta a desconhecida (sincronização lê tudo e marca o que sumiu), salvo "Já sei".
- Palavra na fila não muda de estado; o painel mostra "na fila" ou "exportada em <data>".
- AnkiConnect: **não usar `getDeckStats`** (cria deck quando o nome não existe); usar `deckNamesAndIds`/`findCards`.

## 6. Cartas e áudio

- Painel em inglês (JMdict, offline); Word Meaning da carta em **português**, curto e contextual, pelo Gemini na mesma chamada da tradução da frase; glosa EN não vai para a carta (ADR 0009). Contradiz ESCOPO decisão 4, tabela de campos, CLAUDE.md e nota do CARDS.md.
- Termos: **Carta** = item da fila no app; **Card** = o que existe no Anki. Botão "Virar cartão" passa a "Criar carta".
- Carta em duas partes: local no aparelho ao criar (offline), Gemini no servidor pela ação `generate`, com trava `gerando` (ADR 0010).
- Áudio: PCM do Gemini + cabeçalho WAV, corte de silêncio nas pontas na Edge Function; pronúncia da palavra com a leitura como instrução; campo "Texto para a voz" (kana, opcional) e botão "Refazer áudio". R5 confirma a instrução de pronúncia.
- Áudio sai do bucket 30 dias depois do Lote baixado; reexportar depois disso regera.
- Lote sem limite rígido; mostra tamanho estimado; aviso acima de 100 cartas; R1 mede 100 cartas com áudio no iPhone. (Q42 sem resposta explícita; assumida a recomendação.)
- Frequency = ranking JPDB só o número; Notes vazio salvo digitação.
- Etiquetas: `dokusho` **e** `dokusho::<título do livro>` (espaços trocados por `_`). Muda a decisão de 15/10 e o CLAUDE.md ("etiqueta só dokusho").

## 7. Gemini e custo

- Custo esperado: centavos de dólar por mês; R5 mede tokens.
- `GEMINI_KEY` do projeto pago (sem uso dos dados para treino) + alerta de orçamento no Google Cloud (ex.: US$ 5/mês).
- Travas contra abuso: cadastro desligado no Supabase depois da conta criada; Edge Function só aceita `ALLOWED_USER_ID` (secret); teto diário de chamadas (ex.: 300) contado numa tabela.
- Nomes dos modelos em configuração da função, com lista de reserva (texto: Flash; voz: Flash TTS, Orus).
- Tradução: PT-BR natural mas próximo da estrutura; frase anterior e seguinte só como contexto (~100 tokens a mais, custo desprezível); mesma chamada devolve o significado da palavra; cache por frase.
- Estado **erro** na Carta, com motivo; 3 tentativas automáticas com espera crescente; depois botão "Tentar de novo". "Gerada" só com todas as partes ok; exportar carta em erro é opcional, com aviso.

## 8. Segurança e backup

- Repositório `Igor-Boson/dokusho` **público** e continua público; nada comprometedor pode entrar. Varredura (20/10): nenhuma chave no histórico; commits com e-mail noreply; só o CARDS.md tem o id da tarefa agendada e o link do artifact (saem na limpeza; ficam no histórico, sem risco prático).
- Login por e-mail + senha (Senhas do iCloud); **sem magic link** (no iOS abre no Safari, que não compartilha dados com a PWA). Leitura funciona com sessão vencida; sincronização espera a rede.
- Botão "Baixar backup" (zip JSON de todas as tabelas, sem EPUB e áudio) e "Restaurar backup"; configurações mostram "último backup: há N dias". Sem lembrete.
- Pausa do Supabase aceita; app mostra "servidor pausado; reative no painel" com link quando a sincronização falhar por isso.
- `webCorsOriginList` do AnkiConnect: só a URL de produção e `http://localhost:5173`; nunca `*`.

## 9. PWA e deploy

- Sem push protection nem gitleaks (decisão do Igor). Só `supabase/.temp` no `.gitignore`.
- Atualização do app sem `skipWaiting`: aviso "Nova versão: atualizar" fora do leitor; entra sozinha na próxima abertura (ADR 0011).
- Previews da Vercel desligados; só `main` vai para produção; migrações só por `db push` revisado.
- Endereço fixo num subdomínio da Vercel (ex.: `dokusho-igor.vercel.app`), sem domínio próprio. Definir antes do V1.7.
- .apkg no iPhone/iPad pela folha de compartilhamento (Web Share API) → AnkiMobile; no Windows, download. R1 testa na PWA instalada.
- EPUB no iPhone só por Arquivos → "Importar EPUB" (PWA não recebe "abrir com"); caminho preferido é importar no PC.

## 10. Fora do escopo

- Google Drive, OneDrive e pasta local saem da interface (código fica); Supabase é a única sincronização; backup do ttu substituído por "Baixar backup".
- Audiobook e legendas do ttu fora; botões somem; handler do Supabase implementa `saveAudioBook`/`saveSubtitleData` como no-op.
- Envio direto ao Anki por AnkiConnect (`addNotes`) fora; um caminho só, o .apkg.
- Lista final fora do escopo: mangá e não-EPUB; DRM; LLM além do Gemini; extensão do Yomitan; notificações e lembretes; mais de um usuário; cards pelas conversas do Claude; folhas de escrita e KANJIDIC; JMnedict; pitch accent (campos vazios); sync por Drive/OneDrive/pasta; audiobook e legendas; envio direto ao Anki; outro idioma; texto que não vem de EPUB; explicação de gramática.
- v3: (1) furigana gerado + adaptativo; (2) estatísticas cruzando leitura e vocabulário, com palavras vistas; (3) exportar CSV de conhecidas e aprendendo.

## Fechamento

### Ficou só na conversa (não está em nenhum arquivo)

- A explicação de como o ttu funciona por dentro: livro pelo título, HTML processado no lugar do EPUB, marcador por `exploredCharCount`, merge de estatísticas por linha inteira, service worker com `skipWaiting`. As decisões tiradas disso estão aqui e nos ADRs; o diagnóstico do código não.
- A conta de custo do Gemini (centavos por mês a ~200 cartas) e o cálculo de ~300 KB por carta (só o resultado está aqui).
- O incidente dos decks `???` criados por `getDeckStats` (resolvido pelo Igor; a lição está na seção 5).
- ~~Tudo desta entrevista ainda está fora dos documentos que os chats leem.~~ Aplicado em 20/10: ESCOPO, CLAUDE.md, CARDS.md, FASES.md e PROGRESSO.md atualizados; FASES ganhou o item D1 (protótipo das telas).

### Ficou sem decisão

- Modo de leitura no PC (provavelmente vertical com páginas, não fixado).
- Regra dos toques (Q17): confirmar ao desenhar as telas.
- Q42 (tamanho do Lote): sem resposta, recomendação assumida.
- Números a calibrar: frequência N da importação inicial "Já sei"; teto diário do Gemini (300?); alerta de orçamento (US$ 5?); corte da frase (~150 caracteres); intervalo do marcador (~15 s); prazo do áudio no bucket (30 dias).
- Nome do subdomínio da Vercel (definir antes do V1.7).
- Tokenizador: decidido pelas medições do R3, contra as metas do ADR 0004.
- Instrução de pronúncia no TTS: o R5 diz se funciona; senão, a palavra é lida a partir do kana.
- Não discutido: detalhes da tela inicial (início da semana, hora de virada do dia, fuso horário em viagem), metas de leitura, como desfazer um "Já sei", conteúdo da tela Vocabulário (v2), o que "Restaurar backup" faz com dados existentes (substituir ou mesclar), fontes e acessibilidade.

### Mudanças para os documentos

**ESCOPO.md**
1. Princípios: "o Anki é a fonte da verdade; o app só lê" → o Anki manda nas Palavras dele, "Já sei" cobre as outras (ADR 0007). Repositório público: nada sensível nos docs.
2. Interface: botão "Criar carta" (não "Virar cartão"); painel com várias entradas por frequência, setas ‹ ›, "Já sei" (v2), "na fila / exportada em"; barra verde de parágrafos lidos; regra dos toques; furigana da v1 só o do EPUB; aviso ao apagar livro; aviso "Nova versão" fora do leitor; configurações com versão do dicionário e backup.
3. Decisões fechadas: dicionário preparado no PC (ADR 0004); deflexão pelo tokenizador (ADR 0005); seleção híbrida (ADR 0003); Gemini faz tradução, significado em português e áudio.
4. Hub: suspenso sem `leech`; "Já sei"; gramática fora da cobertura; importação inicial por frequência; Sincronizar Anki chama o `sync` do AnkiWeb antes; leitura completa marca o que sumiu; casamento pela entrada do JMdict (ADR 0008); decks `1. Dokusho`, `2. Kaishi 1.5k`, `3. Old`.
5. Cards: Word Meaning em português contextual pelo Gemini (ADR 0009); geração em duas partes (ADR 0010); estados pendente/gerando/gerada/erro/exportada; Lotes com data e aparelho; cada carta exportada uma vez; guid com leitura (ADR 0006); etiquetas `dokusho` e `dokusho::<título>`; Frequency = ranking JPDB; áudio WAV com cabeçalho, corte de silêncio, instrução de pronúncia, "Texto para a voz", "Refazer áudio"; áudio apagado 30 dias após o Lote baixado.
6. Roadmap: critério da v1 inclui significado em português; v3 com três itens; fora do escopo com a lista da seção 10.
7. Arquitetura e dados: livro por hash, bucket com processado + original (ADR 0001); LWW pelo relógio do aparelho, `updated_at` só cursor (ADR 0002); `reading_stats` por livro + dia + aparelho; `vocab` com origem (anki/manual), entrada do JMdict e leech; tabelas novas para Lotes e para o teto diário do Gemini; bucket `dicts` com o dicionário no formato do app; Edge Function com `translate` e `generate`; Auth por e-mail + senha, cadastro desligado, `ALLOWED_USER_ID`; modelos em configuração.
8. Riscos: metas do dicionário; CORS do AnkiConnect só com as URLs exatas e sem `getDeckStats`; servidor pausado com mensagem própria; novos riscos: atualização do service worker (ADR 0011), download no iOS (Web Share), magic link no iOS, abuso da função `gemini`.
9. Decisões recentes de 15/10: a nº 4 (significado em inglês) foi revertida; a nº 1 (etiqueta só `dokusho`) mudou.

**CLAUDE.md**: Word Meaning em português pelo Gemini (painel em inglês); etiquetas; deflexão pelo tokenizador em vez de "deflexão própria"; guid com leitura; o Anki casa o deck pelo nome; regra dos estados com `leech` e "Já sei"; Carta × Card; não usar `getDeckStats`; repositório público; apontar para GLOSSARY.md e docs/adr/.

**CARDS.md**: remover o fluxo das conversas (tarefa agendada, artifact, passo a passo) e o deck rpg; Kaishi é "2."; deck casado pelo nome; guid com leitura; significado em português pelo Gemini; etiquetas; no app, áudio WAV sem conversão.

**FASES.md**: S1 (`supabase/.temp` no `.gitignore`); S2 (só e-mail + senha, cadastro desligado, tabelas novas); R1 (Web Share e Lote de 100 cartas no iPhone); R2 (CORS exato, `sync` antes, sem `getDeckStats`); R3 (script de preparo do dicionário, JmdictFurigana, metas); R4 (casamento pela entrada do JMdict); R5 (`ALLOWED_USER_ID`, teto, PCM→WAV, corte de silêncio, pronúncia, significado em português, modelos em configuração); V1.1 (hash, processado + original, estatísticas por aparelho, pergunta do marcador); V1.2 reescrito (sem importação Yomitan no aparelho); V1.3 (seleção híbrida, setas, entradas, regra da frase, barra de parágrafos); V1.5 (duas partes, estado erro); V1.6 (Lotes, Web Share, etiquetas); V1.7 (sem `skipWaiting`, previews desligados, subdomínio fixo, esconder Drive/OneDrive/audiobook, backup); V2.1 (leech, `sync` antes, "Já sei", casamento); V3 com três itens.
