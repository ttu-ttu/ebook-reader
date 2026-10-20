# Dicionário preparado no PC, não importado no aparelho

O formato Yomitan é a entrada, mas o aparelho nunca importa o zip. Um script em `tools/` converte os zips (JMdict, JPDB, JmdictFurigana) uma vez, no PC, para um formato enxuto do app, que vai para o bucket `dicts`. Cada aparelho só baixa e grava no IndexedDB.

O JMdict_english tem 15 MB compactado e 171 MB de JSON descompactado. Importar isso numa PWA no iPhone é lento, e o iOS pausa a PWA em segundo plano, o que quebra a importação no meio. Isso se repetiria em cada aparelho e a cada reinstalação. O custo é perder a importação de qualquer dicionário Yomitan pela tela de configurações: um dicionário novo passa pelo script no PC.

## Consequences

- Metas no iPhone (primeira instalação): download ≤ 60 MB com o tokenizador, preparação ≤ 1 min, consulta ≤ 100 ms.
- O dicionário fica congelado na versão enviada; atualizar é rodar o script de novo, e a versão aparece nas configurações.
- Arquivos pesados ficam fora de `static/` (o service worker baixa tudo de novo a cada deploy), num armazenamento versionado que o deploy não apaga.
