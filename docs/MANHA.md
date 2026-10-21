Temporário: apagar depois de executar os passos. O que for permanente já está em PROGRESSO.md.

# Manhã (21/10)

## (a) O que testar primeiro, em ordem

1. No PC, rodar o app local e entrar na conta (passos 1–4 abaixo).
2. Biblioteca: importar um EPUB; abrir; tocar em palavras (painel, setas, "Traduzir frase").
3. "Criar carta" em 2–3 palavras; Fila: ver virarem "gerada" (significado em português e áudio).
4. Fila › "Exportar .apkg" → importar no Anki do PC; reimportar ("Lotes" › "Baixar este Lote de
   novo") e ver que não duplica.
5. Início: conferir tempo e caracteres.
6. Depois da Vercel: o mesmo no iPhone (PWA) e a continuação de leitura entre aparelhos.

## (b) Passo a passo do que depende de você

1. Abra o PowerShell na pasta do projeto e troque para o branch da noite:

   ```
   git checkout v1-autonomo
   ```

   Deve aparecer `Switched to branch 'v1-autonomo'`.

2. Instale as dependências:

   ```
   pnpm install --frozen-lockfile
   ```

3. Rode o app:

   ```
   pnpm dev
   ```

   Abra `http://localhost:5173` no Chrome: deve abrir a tela **Início**.

4. Configurações (⚙ no Início) › aba **Data** › **Conta** › "Entrar ou sair": entre com e-mail e
   senha. Volte.
5. Configurações › Data › **Dicionário** › "Baixar" (ou toque numa palavra no leitor: o aviso de
   tamanho aparece). Espere "Versão jmdict-…". Toque em **Medir velocidade** e me devolva a linha
   que aparecer.
6. Biblioteca › importe um EPUB seu. Abra e toque em ~30 palavras. Me devolva: quantas seleções
   saíram erradas e quais (palavra tocada → o que o painel mostrou).
7. No painel, toque em "Criar carta" em 10 palavras. Abra a **Fila**: as cartas passam de
   "pendente" para "gerada" (uma por vez, ~16 s cada). Me devolva quantas deram "erro" e o motivo.
8. Abra uma carta, ouça os dois áudios, edite um campo, use "Refazer áudio" numa. Me diga se algo
   falhou.
9. Fila › "Exportar .apkg" › "Baixar .apkg". No Anki do PC: Arquivo › Importar o arquivo baixado.
   Deve entrar no deck `日本語::1. Dokusho` com áudio. Depois: Fila › aba **Lotes** › abra o Lote ›
   "Baixar este Lote de novo" › importe de novo: não pode duplicar. Me devolva o resultado.
10. Início: compare tempo e caracteres de hoje com Estatísticas do ttu (menu do leitor). Devem bater.
11. Configurações › Data › Backup › "Baixar backup" › "Salvar o backup". Guarde o zip.
12. Vercel (vercel.com, logado com o GitHub): "Add New… › Project", escolha o repositório dokusho.
    Root Directory: `apps/web`; Framework: SvelteKit. Em Environment Variables, cole
    `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` (os mesmos valores do seu `apps/web/.env`).
    Deploy. Me devolva a URL (`…vercel.app`).
13. Vercel › Project › Settings › Git: desligue os deploys de preview (só `main` em produção).
    Atenção: o código novo está em `v1-autonomo`; para ir ao ar, ele precisa ser juntado ao `main`
    (me peça e eu abro o PR).
14. Supabase › Authentication › URL Configuration: Site URL = a URL da Vercel. Salve.
15. Anki do PC › Ferramentas › Complementos › AnkiConnect › Configurar: em `webCorsOriginList`,
    acrescente a URL da Vercel (sem barra no fim), ao lado de `http://localhost:5173`. Reinicie o Anki.
16. iPhone, Safari: abra a URL da Vercel, Compartilhar › "Adicionar à Tela de Início". Abra pelo
    ícone, entre na conta, baixe o dicionário (Configurações › Data) e toque em "Medir velocidade".
    Me devolva a linha e o tempo do download.
17. No iPhone: abra o livro importado no PC; deve perguntar "Você parou no Windows… Ir para lá?".
    Toque em 30 palavras (contar erradas). Fila › "Exportar .apkg" › "Compartilhar com o Anki" ›
    AnkiMobile. Reimporte pelo Lote: não pode duplicar. Me devolva os resultados.
18. Google Cloud › Billing › Budgets & alerts: crie um alerta (ex.: US$ 5/mês) no projeto da
    GEMINI_API_KEY.
