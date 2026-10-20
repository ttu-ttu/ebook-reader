# Casamento texto ↔ Anki pela entrada do dicionário

O texto e o Anki não são comparados pela escrita. Na Sincronização do Anki, cada (Word, Word Reading) é ligado a uma entrada do JMdict, e cada palavra do texto também cai numa entrada. São a mesma Palavra quando caem na mesma entrada com a mesma leitura (a exigência da mesma leitura foi substituída pelo ADR 0013: basta a mesma entrada). Um cartão que não casa com nenhuma entrada fica guardado pela escrita.

Romances escrevem em kana o que o Kaishi tem em kanji (わかる × 分かる × 判る), e comparar a escrita trataria essas formas como Palavras diferentes. O custo é depender do dicionário para casar; o R4 mede quantos cartões ficam sem entrada.
