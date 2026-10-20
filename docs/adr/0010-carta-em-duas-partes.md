# Carta gerada em duas partes: local no aparelho, Gemini no servidor

Ao criar a carta, o aparelho preenche na hora, mesmo offline, tudo o que vem do dicionário: escrita, leitura, furigana, frase com `<b>`, frequência. A parte que precisa do Gemini (tradução da frase, significado em português, os dois áudios) é feita por uma ação `generate` da Edge Function, que recebe o id da Carta, a trava (estado `gerando`), grava os áudios no bucket e preenche os campos.

Se toda a geração rodasse no aparelho, uma Carta criada offline no iPhone só seria gerada quando aquele app abrisse de novo com rede, e dois aparelhos abertos ao mesmo tempo gerariam a mesma Carta duas vezes, pagando o Gemini em dobro. O dicionário vive só no aparelho, por isso a parte local não vai para o servidor.
