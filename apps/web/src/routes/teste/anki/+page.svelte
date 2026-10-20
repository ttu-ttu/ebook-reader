<script lang="ts">
  // Página provisória do R2: sync do AnkiWeb, depois lê os Cards dos decks 日本語::* pelo AnkiConnect.
  // Só leitura (fora o sync). Apagar no V2.1.
  import { buttonClasses, inputClasses, pxScreen } from '$lib/css-classes';
  import {
    criarAnkiConnect,
    ErroAnkiConnect,
    URL_ANKI_CONNECT,
    type CardAnki,
    type DeckAnki
  } from '$lib/functions/anki/anki-connect';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  let url = URL_ANKI_CONNECT;
  let raiz = '日本語';
  let sincronizarAntes = true;

  let ocupado = false;
  let medidas: string[] = [];
  let mensagem = '';
  let decks: DeckAnki[] = [];
  let cards: CardAnki[] = [];
  let filtro = '';

  $: origem = typeof location === 'undefined' ? '' : location.origin;
  $: visiveis = (
    filtro
      ? cards.filter((card) => card.word.includes(filtro) || card.wordReading.includes(filtro))
      : cards
  ).slice(0, 300);
  $: porDeck = decks.map((deck) => ({
    ...deck,
    total: cards.filter((card) => card.deck === deck.nome).length
  }));
  $: contagem = {
    suspensos: cards.filter((card) => card.suspenso).length,
    leech: cards.filter((card) => card.leech).length,
    novos: cards.filter((card) => card.tipo === 0).length,
    maduros: cards.filter((card) => card.intervalo >= 21).length
  };

  function intervalo(card: CardAnki) {
    if (card.tipo === 0) return 'novo';
    if (card.intervalo < 0) return `${Math.round(-card.intervalo / 60)} min`;
    return `${card.intervalo} d`;
  }

  async function medir<T>(nome: string, passo: () => Promise<T>) {
    const t = performance.now();
    const resultado = await passo();
    medidas = [...medidas, `${nome}: ${Math.round(performance.now() - t)} ms`];
    return resultado;
  }

  async function testar() {
    ocupado = true;
    medidas = [];
    mensagem = '';
    decks = [];
    cards = [];
    const anki = criarAnkiConnect({ url });
    try {
      const versao = await medir('version', () => anki.invocar<number>('version'));
      medidas = [...medidas, `AnkiConnect versão ${versao}`];
      if (sincronizarAntes) await medir('sync com o AnkiWeb', anki.sincronizar);
      decks = await medir('deckNamesAndIds', () => anki.listarDecks(raiz));
      cards = await medir('findCards + cardsInfo + notesInfo', () => anki.buscarCards(raiz));
      medidas = [...medidas, `${cards.length} Cards`];
    } catch (erro) {
      const tipo = erro instanceof ErroAnkiConnect ? ` (${erro.tipo})` : '';
      mensagem = `Erro${tipo}: ${erro instanceof Error ? erro.message : String(erro)}`;
    } finally {
      ocupado = false;
    }
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Teste AnkiConnect')}</title>
</svelte:head>

<div class="{pxScreen} mx-auto max-w-4xl pt-16 pb-16">
  <h1 class="mb-4 text-2xl">Teste AnkiConnect (R2)</h1>
  <p class="mb-8 text-sm opacity-75">
    Origem desta página: <code>{origem}</code> — precisa estar no <code>webCorsOriginList</code> do AnkiConnect
    (docs/ANKI-CONNECT.md).
  </p>

  <div class="mb-6 grid max-w-sm gap-4">
    <label class="block">
      URL do AnkiConnect
      <input class={inputClasses} bind:value={url} />
    </label>
    <label class="block">
      Deck raiz
      <input class={inputClasses} bind:value={raiz} />
    </label>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={sincronizarAntes} />
      Sincronizar com o AnkiWeb antes
    </label>
    <button class={buttonClasses} disabled={ocupado} on:click={testar}>
      {ocupado ? 'Lendo…' : 'Testar'}
    </button>
  </div>

  <ul class="mb-4">
    {#each medidas as medida}
      <li>{medida}</li>
    {/each}
  </ul>
  {#if mensagem}
    <p class="mb-4">{mensagem}</p>
  {/if}

  {#if cards.length}
    <ul class="mb-4">
      {#each porDeck as deck}
        <li>{deck.nome}: {deck.total}</li>
      {/each}
    </ul>
    <p class="mb-6">
      Suspensos {contagem.suspensos} · leech {contagem.leech} · novos {contagem.novos} · intervalo ≥
      21 d {contagem.maduros}
    </p>

    <label class="mb-4 block max-w-sm">
      Filtrar por Word ou Word Reading
      <input class={inputClasses} bind:value={filtro} />
    </label>
    <p class="mb-2 text-sm opacity-75">Mostrando até 300.</p>
    <table class="w-full text-left text-sm">
      <thead>
        <tr>
          <th>Word</th>
          <th>Word Reading</th>
          <th>Deck</th>
          <th>Intervalo</th>
          <th>Suspenso</th>
          <th>Leech</th>
        </tr>
      </thead>
      <tbody>
        {#each visiveis as card (card.cardId)}
          <tr>
            <td>{card.word}</td>
            <td>{card.wordReading}</td>
            <td>{card.deck.replace(`${raiz}::`, '')}</td>
            <td>{intervalo(card)}</td>
            <td>{card.suspenso ? 'sim' : ''}</td>
            <td>{card.leech ? 'sim' : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
