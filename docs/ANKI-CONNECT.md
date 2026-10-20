# AnkiConnect

O app lê o Anki do PC (Windows) pelo add-on AnkiConnect, em `http://127.0.0.1:8765`, a partir do
Chrome. Só a Sincronização do Anki usa isso (V2.1); a página provisória `/teste/anki` (R2) faz o
mesmo caminho.

## Instalar

1. Anki → Ferramentas → Complementos → Obter complementos → código `2055492159` (AnkiConnect).
2. Reiniciar o Anki. Ele precisa estar aberto quando o app ler os Cards.

## webCorsOriginList

O AnkiConnect só responde a páginas cujas origens estão nessa lista. Ferramentas → Complementos →
AnkiConnect → Configuração:

```json
{
  "webCorsOriginList": ["http://localhost:5173", "https://<subdominio>.vercel.app"]
}
```

- Só as URLs exatas: a do `pnpm dev` e a de produção (subdomínio fixo escolhido no V1.7). Nunca `*`:
  qualquer site aberto no navegador poderia ler e alterar a coleção.
- Sem barra no fim; esquema, host e porta iguais aos do endereço do app.
- Os outros campos da configuração ficam como estão. Reiniciar o Anki depois de mudar.

## Chrome: acesso à rede local

Uma página em `https://` que chama `127.0.0.1` cai na regra de acesso à rede local do Chrome. Na
primeira chamada o Chrome pode perguntar se o site pode acessar dispositivos da rede local: aceitar.
Se a permissão for negada, liberar em Configurações do site (cadeado na barra de endereço). Pelo
`http://localhost:5173` o Chrome não pergunta.

## Regras

- Nunca `getDeckStats`: ele cria o deck quando o nome não existe. Usar `deckNamesAndIds` e
  `findCards`.
- O cliente (`apps/web/src/lib/functions/anki/anki-connect.ts`) só deixa passar `version`, `sync`,
  `deckNamesAndIds`, `findCards`, `cardsInfo` e `notesInfo`. Nada que escreva na coleção: os Cards
  chegam ao Anki só pelo .apkg.
- `sync` sincroniza o Anki do PC com o AnkiWeb (pega as revisões do celular) e volta quando a coleção
  terminou; exige estar logado no AnkiWeb dentro do Anki. Logo depois o Anki roda a sincronização da
  interface e recusa leituras com "Collection lifecycle operation is active": o cliente repete
  `deckNamesAndIds` a cada 0,5 s até a coleção liberar (no máximo o tempo limite do sync).
- Leitura: `findCards` com `"deck:日本語"` (inclui os subdecks), depois `cardsInfo` (intervalo,
  `queue`, campos) e `notesInfo` (etiquetas, onde está o `leech`), em lotes de 200 ids.
- `queue = -1` é suspenso; `interval` negativo é segundos (Card em aprendizado), positivo é dias.
