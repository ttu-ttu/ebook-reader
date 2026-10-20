# Tokenizador: lindera-wasm com IPADIC embutido

O tokenizador do app é o `lindera-wasm-ipadic` (wasm, licença MIT, dicionário IPADIC dentro do wasm), e não o kuromoji.js. A forma de dicionário vem de `details[6]` e a leitura em katakana de `details[7]`.

Na bancada do R3 (Node, 10 frases conjugadas e 77 mil caracteres), os dois cortaram as frases do mesmo jeito, porque os dois usam o IPADIC (気がつい → 気がつく, 立ち止まっ → 立ち止まる). O lindera carregou em 1,1 s contra 3,6 s, tokenizou 10 vezes mais rápido (0,3 s contra 3,2 s) e ocupou 137 MB contra 320 MB, o que pesa no iPhone. O download é parecido: 16,5 MB em gzip contra 17,8 MB. O kuromoji.js está parado desde 2022. O Sudachi não tem pacote wasm pronto, e o dicionário dele passaria da meta de 60 MB.

## Consequences

- O wasm não entra no cache de build do service worker (ele seria baixado de novo a cada deploy). O app o baixa uma vez e o guarda num cache próprio, que o service worker não apaga.
- O IPADIC não reconhece gírias e palavras novas; a reserva fica com as regras próprias (ADR 0005).
