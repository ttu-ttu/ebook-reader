Temporário: apagar depois de executar os passos. O que for permanente já está em PROGRESSO.md.

# Deploy da v1

O código da v1 está pronto no PR do `v1-autonomo`. Um passo por vez:

1. No GitHub, abra o PR "v1: leitor sincronizado, dicionário, cartas e .apkg" e clique em
   **Merge pull request** › **Confirm merge**. O `main` passa a ter a v1.
2. Em vercel.com (entre com o GitHub): **Add New… › Project**, escolha o repositório `dokusho` e
   clique em **Import**.
3. Na tela de configuração: **Root Directory** = `apps/web` (botão "Edit"). Deixe o resto como
   está: o `apps/web/vercel.json` já diz os comandos e a pasta `build`.
4. Ainda nessa tela, em **Environment Variables**, adicione três: `PUBLIC_SUPABASE_URL` e
   `PUBLIC_SUPABASE_ANON_KEY` (os mesmos valores do seu `apps/web/.env`) e
   `ENABLE_EXPERIMENTAL_COREPACK` = `1` (para a Vercel usar o pnpm 12 do projeto). Clique em **Deploy**.
   Deve terminar com "Congratulations" e uma URL `…vercel.app`. Me devolva a URL.
5. Vercel › o projeto › **Settings › Domains**: se quiser outro nome, troque o subdomínio
   `…vercel.app` agora (trocar depois obriga a reinstalar o app em cada aparelho).
6. Vercel › **Settings › Git**: em "Ignored Build Step" escolha **Only build production** (sem
   previews). A branch de produção deve ser `main`.
7. Supabase › seu projeto › **Authentication › URL Configuration**: **Site URL** = a URL da Vercel.
   **Save**.
8. Anki do PC › **Ferramentas › Complementos › AnkiConnect › Configurar**: em `webCorsOriginList`,
   acrescente a URL da Vercel, sem barra no fim (ex.: `"https://dokusho.vercel.app"`), ao lado de
   `"http://localhost:5173"`. **OK** e reinicie o Anki.
9. No iPhone, Safari: abra a URL, **Compartilhar › Adicionar à Tela de Início**. Abra pelo ícone e
   entre na conta. Deve abrir na tela Início, com o livro do PC na Biblioteca (ícone de nuvem).
10. Quando terminar os testes com o Gemini, volte o teto para 300 (PowerShell, na pasta do projeto):

    ```
    npx supabase secrets set GEMINI_TETO_DIARIO=300
    ```

11. Google Cloud › **Billing › Budgets & alerts › Create budget**: alerta de US$ 5 por mês no projeto
    da GEMINI_API_KEY.
12. Supabase › **SQL Editor**: cole o conteúdo de `supabase/tests/rls_check.sql`, **Run**; deve dar
    dono = 1 e outro = 0.
