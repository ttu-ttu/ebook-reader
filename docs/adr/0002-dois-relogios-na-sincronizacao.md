# Dois relógios na sincronização

"Última escrita vence" usa o horário do aparelho no momento em que você agiu (ex.: `lastBookmarkModified`), não o horário em que o dado chegou ao servidor. O `updated_at` do servidor serve só de cursor, para cada aparelho perguntar "o que mudou desde a última vez".

Com o horário do servidor, um aparelho que ficou offline e sincroniza depois venceria com um dado mais velho: ler até 30% no avião e até 50% no iPad faria o marcador voltar a 30% quando o iPhone pousasse. O custo é depender do relógio dos aparelhos, que no iPhone, iPad e Windows é acertado pela rede.

## Consequences

- As estatísticas de leitura têm uma linha por livro, dia e aparelho, somadas na exibição, então dois aparelhos no mesmo dia nunca se sobrescrevem.
