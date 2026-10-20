# Deflexão pela forma de dicionário do tokenizador

Em vez de uma tabela própria de regras de conjugação, a busca usa a forma de dicionário que o tokenizador já devolve para cada pedaço: testa "pedaços inteiros + forma de dicionário do último pedaço" contra o dicionário (気|が|つい|た → 気がつく). Um punhado de regras próprias serve de reserva quando a análise do tokenizador não acha nada.

A regra original ("busca e deflexão próprias", porque o Yomitan é GPL) pedia escrever dezenas de regras gramaticais sem copiar a tabela do Yomitan. O tokenizador já faz esse trabalho. O custo é herdar os erros dele em palavras raras, gírias e kana fora do padrão. Os testes escritos primeiro são uma lista de ~100 formas conjugadas tiradas dos EPUBs reais, com a Palavra esperada para cada uma.
