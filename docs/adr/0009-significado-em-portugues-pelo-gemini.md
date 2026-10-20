# Significado da carta em português, gerado pelo Gemini

O painel ao tocar mostra a glosa em inglês do JMdict (instantânea e offline). O campo Word Meaning da carta recebe um significado curto em português, gerado pelo Gemini a partir da frase, no sentido em que a palavra aparece nela. A glosa em inglês não vai para a carta.

Isso reverte a decisão de 15/10 ("Word Meaning em inglês, só a tradução da frase em português"): o Igor quer o significado em português, e o JMdict não tem português. Pedir português a cada toque deixaria o painel dependente de internet e lento; gerar só na carta mantém o painel offline e põe o custo onde já há chamada ao Gemini (a tradução da frase vai na mesma chamada).

## Consequences

- O significado é contextual (o sentido daquela frase), não a lista de acepções; é editável como os outros campos.
- ESCOPO, CLAUDE.md e a nota do CARDS.md mudam.
