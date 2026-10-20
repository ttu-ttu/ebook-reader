# guid da nota por escrita e leitura

O guid das notas passa de `guid_for("leituras-igor", palavra)` para `guid_for("leituras-igor", palavra, leitura)`. O prefixo continua o mesmo.

Com o guid só pela escrita, duas Palavras com a mesma escrita e leituras diferentes (開く あく/ひらく, 止める とめる/やめる, 方 かた/ほう, todas no Kaishi do Igor) seriam a mesma nota no Anki, e importar a segunda apagaria o conteúdo da primeira sem aviso. As 14 notas antigas do deck guardam o guid antigo; elas só se cruzariam com uma carta nova da mesma palavra, o que é aceitável.

## Consequences

- O CARDS.md muda (é a fonte única). O deck é casado pelo nome na importação, não pelo ID; o nome exato `日本語::1. Dokusho` é o que importa. O `MODEL_ID` continua decidindo o tipo de nota.
