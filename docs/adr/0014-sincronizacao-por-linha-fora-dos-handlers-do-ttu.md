# Sincronização com o Supabase por linha, fora dos handlers do ttu

O FASES pedia um handler novo em `apps/web/src/lib/data/storage/handler`, no padrão dos do Google
Drive e do OneDrive. O Dokusho sincroniza com um módulo próprio (`lib/data/supabase/sincronizacao/`)
que lê e grava o IndexedDB do ttu diretamente e troca **linhas** com as tabelas do Supabase. O
leitor, a biblioteca e as estatísticas do ttu continuam iguais; o sincronizador roda por baixo.

Os handlers do ttu foram feitos para copiar **arquivos** entre duas fontes, num gesto manual
("replicar"): o livro é um zip, o marcador é um arquivo cujo nome carrega o horário e o progresso, as
estatísticas são um arquivo por livro, e tudo é identificado pelo **título**. O Dokusho precisa de
outra coisa: livro pelo hash do EPUB (ADR 0001), última escrita por linha pelo horário do aparelho
com soft delete (ADR 0002), estatísticas com uma linha por livro, dia e aparelho, envio automático do
marcador a cada ~15 s e cursor `updated_at` para baixar só o que mudou. Encaixar isso nos ~25 métodos
abstratos do `BaseStorageHandler` exigiria traduzir linhas em nomes de arquivo e de volta, sem ganho.

## Considered Options

- Handler do ttu (o que o FASES dizia): herda a replicação manual, a identificação pelo título e o
  merge por arquivo que ressuscita dado apagado.
- Trocar o IndexedDB do ttu por tabelas próprias: mexe no leitor inteiro.

## Consequences

- O IndexedDB do ttu continua indexado pelo título. O sincronizador guarda num banco próprio
  (`dokusho-sinc`) o mapa título → hash, o que já foi enviado, os cursores, o EPUB original até subir,
  o Alcance e as estatísticas dos outros aparelhos. Dois livros com o mesmo título continuam
  impossíveis no mesmo aparelho (limitação do ttu); o segundo não é baixado.
- As estatísticas locais do ttu são só as deste aparelho; as dos outros ficam no banco próprio e a
  tela inicial (V1.4) soma as duas.
- O livro na nuvem ainda não baixado vira um livro "placeholder" do ttu (sem `elementHtml`), que a
  biblioteca já sabe mostrar.
- Os handlers de Drive, OneDrive e pasta local ficam no código e saem da interface (V1.7).
