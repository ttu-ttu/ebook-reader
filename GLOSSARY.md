# Dokusho

Leitor de EPUB japonês para uso pessoal que junta leitura, dicionário, criação de cartões do Anki e um registro do vocabulário que o leitor já conhece.

## Vocabulário e Anki

**Palavra**:
Uma entrada de vocabulário identificada pelo par forma de dicionário + leitura em hiragana (Word, Word Reading).
_Avoid_: termo, vocábulo, token

**Estado da palavra**:
A classificação de uma Palavra em conhecida, aprendendo ou desconhecida, calculada a partir dos Cards do Anki e da marca Já sei; vale o estado mais avançado.
_Avoid_: status, nível

**Hub de vocabulário**:
O registro central das Palavras e dos seus Estados, alimentado pela Sincronização do Anki.
_Avoid_: banco de vocabulário

**Já sei**:
A marca que você dá no app a uma Palavra que conhece mas que não está no Anki; conta como conhecida.
_Avoid_: ignorar, conhecida manual

**Cobertura**:
A porcentagem das Palavras de um Livro, sem contar gramática (partículas, auxiliares), que estão no estado conhecida.
_Avoid_: familiaridade, compreensão

**Sincronização do Anki**:
A leitura dos Cards do Anki do PC, que atualiza o Hub; só acontece no Windows, quando você aperta o botão.
_Avoid_: sync do Anki, importação do Anki

## Cartas

**Carta**:
O item da Fila de cartas no app, que passa por pendente, gerada e exportada; vira um Card quando o Lote é importado no Anki.
_Avoid_: cartão, card (para o item do app), nota

**Card**:
O que existe no Anki: o cartão que você revisa, de onde o Hub tira o Estado da palavra.
_Avoid_: cartão, carta (para o que está no Anki)

**Fila de cartas**:
A lista das Cartas criadas no app que ainda não foram descartadas, com o estado de cada uma.
_Avoid_: batch, lista de mineração

**Lote**:
O conjunto de cartas exportadas juntas num mesmo arquivo .apkg, com data e aparelho onde foi baixado.
_Avoid_: pacote, export

## Leitura

**Alcance**:
O ponto mais distante que você já leu num Livro; ao contrário do Marcador, nunca volta quando você relê.
_Avoid_: progresso máximo, parágrafos lidos

**Frase**:
O trecho do Livro em que a Palavra apareceu, delimitado por 。！？ sem cortar dentro de 「」, sem o furigana do EPUB.
_Avoid_: sentença, contexto

**Livro**:
Um arquivo EPUB importado; dois arquivos diferentes são dois Livros mesmo com o mesmo título.
_Avoid_: obra, título, EPUB (quando se fala do livro na biblioteca)

**Marcador**:
O ponto até onde você leu num Livro, medido em caracteres desde o início; um por Livro, compartilhado entre os aparelhos.
_Avoid_: bookmark, posição, página

**Glosa**:
O significado curto da Palavra, em inglês, tirado do dicionário sem tradução.
_Avoid_: definição, tradução da palavra

**Tradução da frase**:
A frase do livro traduzida para o português pelo Gemini, pedida por você e guardada em cache.
_Avoid_: significado da frase
