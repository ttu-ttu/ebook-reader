<script lang="ts">
  // Página provisória do R1: gera um Lote falso com áudio sintético, mede e exporta o .apkg.
  import { buttonClasses, inputClasses, pxScreen } from '$lib/css-classes';
  import { gerarApkg, type MidiaApkg, type NotaApkg } from '$lib/functions/anki/apkg';
  import { entregarArquivo } from '$lib/functions/anki/entregar-arquivo';
  import { DECK, etiquetasDoLivro } from '$lib/functions/anki/modelo';
  import { carregarSqlJs } from '$lib/functions/anki/sql-js';
  import { wavDeTeste } from '$lib/functions/anki/wav-teste';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  const DECK_TESTE = { id: 1760101099, nome: '日本語::0. Dokusho teste' };

  let quantidade = 100;
  let segundosPalavra = 1;
  let segundosFrase = 4;
  let deckDeTeste = true;

  let ocupado = false;
  let apkg: Blob | undefined;
  let nomeArquivo = '';
  let medidas: string[] = [];
  let mensagem = '';

  function lote(n: number) {
    const notas: NotaApkg[] = [];
    const midias: MidiaApkg[] = [];
    for (let i = 1; i <= n; i += 1) {
      const id = String(i).padStart(3, '0');
      const audioPalavra = `leituras-teste-${id}-p.wav`;
      const audioFrase = `leituras-teste-${id}-f.wav`;
      midias.push(
        { nome: audioPalavra, dados: wavDeTeste(segundosPalavra, 300 + i) },
        { nome: audioFrase, dados: wavDeTeste(segundosFrase, 200 + i) }
      );
      notas.push({
        campos: {
          Word: `テスト${id}`,
          'Word Reading': `てすと${id}`,
          'Word Meaning': `teste ${i}`,
          'Word Furigana': `テスト${id}`,
          'Word Audio': `[sound:${audioPalavra}]`,
          Sentence: `これは<b>テスト${id}</b>です。`,
          'Sentence Meaning': `Isto é o teste ${i}.`,
          'Sentence Furigana': `これは<b>テスト${id}</b>です。`,
          'Sentence Audio': `[sound:${audioFrase}]`,
          Frequency: String(i)
        },
        etiquetas: etiquetasDoLivro('Livro de teste R1')
      });
    }
    return { notas, midias };
  }

  async function gerar() {
    ocupado = true;
    apkg = undefined;
    medidas = [];
    mensagem = '';
    try {
      let t = performance.now();
      const SQL = await carregarSqlJs();
      medidas = [...medidas, `sql.js carregado: ${Math.round(performance.now() - t)} ms`];

      t = performance.now();
      const { notas, midias } = lote(quantidade);
      medidas = [...medidas, `áudio sintético: ${Math.round(performance.now() - t)} ms`];

      t = performance.now();
      apkg = await gerarApkg(SQL, { notas, midias, deck: deckDeTeste ? DECK_TESTE : DECK });
      nomeArquivo = `dokusho-teste-${quantidade}.apkg`;
      medidas = [
        ...medidas,
        `.apkg: ${Math.round(performance.now() - t)} ms, ${(apkg.size / 1024 / 1024).toFixed(1)} MB`
      ];
    } catch (erro) {
      mensagem = `Erro: ${erro instanceof Error ? erro.message : String(erro)}`;
    } finally {
      ocupado = false;
    }
  }

  async function exportar() {
    if (!apkg) return;
    try {
      mensagem = await entregarArquivo(apkg, nomeArquivo);
    } catch (erro) {
      mensagem = `Erro: ${erro instanceof Error ? erro.message : String(erro)}`;
    }
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Teste .apkg')}</title>
</svelte:head>

<div class="{pxScreen} mx-auto max-w-sm pt-16">
  <h1 class="mb-8 text-2xl">Teste .apkg (R1)</h1>

  <label class="mb-4 block">
    Cartas
    <input class={inputClasses} type="number" min="1" max="500" bind:value={quantidade} />
  </label>
  <label class="mb-4 block">
    Segundos de áudio da palavra
    <input class={inputClasses} type="number" min="0" step="0.5" bind:value={segundosPalavra} />
  </label>
  <label class="mb-4 block">
    Segundos de áudio da frase
    <input class={inputClasses} type="number" min="0" step="0.5" bind:value={segundosFrase} />
  </label>
  <label class="mb-6 flex items-center gap-2">
    <input type="checkbox" bind:checked={deckDeTeste} />
    Deck {DECK_TESTE.nome} (desmarcado: {DECK.nome})
  </label>

  <div class="mb-6 flex gap-4">
    <button class={buttonClasses} disabled={ocupado} on:click={gerar}>
      {ocupado ? 'Gerando…' : 'Gerar'}
    </button>
    <button class={buttonClasses} disabled={!apkg || ocupado} on:click={exportar}>Exportar</button>
  </div>

  <ul class="mb-4">
    {#each medidas as medida}
      <li>{medida}</li>
    {/each}
  </ul>
  {#if mensagem}
    <p>{mensagem}</p>
  {/if}
</div>
