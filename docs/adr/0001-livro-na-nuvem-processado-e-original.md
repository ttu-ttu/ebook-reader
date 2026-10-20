# Livro na nuvem: identificado por hash, guardado processado e original

O ttu identifica o livro pelo título e guarda só o HTML processado, descartando o EPUB. No Dokusho, o livro é identificado pelo hash do arquivo EPUB (o título só é exibido), e o bucket guarda as duas formas: o livro processado pelo ttu, que todos os aparelhos leem, e o EPUB original, como backup.

O processado garante que todos os aparelhos leiam o mesmo texto, então a contagem de caracteres, o marcador e as frases das cartas batem entre eles mesmo que uma versão nova do app processe o EPUB de outro jeito. O original continua sendo o arquivo de verdade. O hash evita que duas edições com o mesmo título misturem estatísticas e marcadores.

## Considered Options

- Só o EPUB original (o que o ESCOPO dizia): cada aparelho reprocessa, e uma mudança no processamento desloca posições.
- Só o processado (o que o ttu faz no Google Drive): perde o arquivo original.

## Consequences

- Ocupa cerca de 2× o espaço dos livros no plano de 1 GB. Se apertar, o original pode sair do Supabase.
- Apagar um livro apaga de verdade os dois arquivos do bucket; estatísticas e cartas do livro ficam.
