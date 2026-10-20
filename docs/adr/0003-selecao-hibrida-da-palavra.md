# Seleção híbrida da palavra ao toque

Ao tocar no texto, o tokenizador decide onde a palavra começa e a busca no dicionário (o trecho mais longo que existe no dicionário, já sem conjugação) decide onde ela termina. O painel tem setas ‹ › para encurtar ou alongar a seleção.

Só o tokenizador corta expressões que você quer estudar inteiras (気のせい sai como 気 | の | せい). Só a busca no dicionário, a partir do ponto exato do toque, erra o começo quando o dedo cai no meio da palavra. O híbrido acerta os dois casos, e as setas resolvem o que sobrar sem exigir um algoritmo perfeito.
