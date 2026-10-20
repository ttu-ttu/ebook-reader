# Casamento texto ↔ Anki pela entrada, com qualquer leitura

Substitui a parte do ADR 0008 que exigia a mesma leitura. Uma palavra do texto tem o estado dos Cards que caem na mesma entrada do JMdict (seq), qualquer que seja a leitura do Card. A leitura continua servindo para escolher a entrada no texto (方 かた e 方 ほう são entradas diferentes), mas não entra mais na comparação com o Anki. A marca "Já sei" também vale para a entrada: marcar 皆 cobre みな e みんな.

No R4 (また、同じ夢を見ていた), 16 Palavras do livro, com 171 ocorrências, caíam na mesma entrada de um Card com outra leitura: 皆 みな × みんな ×66, じゃあ × じゃ ×40, こっち × こちら, とっても × とても, どっち × どちら, あんまり × 余り. Quase todas são a mesma palavra, e por serem frequentes apareceriam como desconhecidas no destaque e no topo da lista de desconhecidas. Na palavra em kanji, a leitura é um palpite do IPADIC, não a do autor, e ele errou em 入り口 (いりくち), 一言 (いちげん) e 背負う (しょう). Exigir a mesma leitura era confiar nesse palpite. Só 2 ocorrências viraram falsos positivos (しかして × そして, せる × 迫る).

## Consequences

- Uma leitura nova de uma palavra conhecida (皆 lido みな por quem tem o Card みんな) não aparece como desconhecida. Para compensar, o painel mostra "no Anki como <leitura>" quando a leitura do Card é outra (V2.2).
- O hub guarda a leitura de cada Card (a Palavra continua sendo o par Word, Word Reading), mas casa com o texto pela seq.
- Entradas que o JMdict junta com leituras de sentidos diferentes passam a se misturar. Na medição isso foi raro.
