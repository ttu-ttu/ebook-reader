<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import EditorCarta from '$lib/components/fila/editor-carta.svelte';
  import NavegacaoInferior from '$lib/components/navegacao/navegacao-inferior.svelte';
  import { pagePath } from '$lib/data/env';
  import { isOnline$ } from '$lib/data/store';
  import { geracao, gerandoAgora$, gerarPendentes, htmlDaFrase } from '$lib/data/cartas/fila';
  import { cartasRecebidas$, sincronizador } from '$lib/data/supabase/sincronizacao/iniciar';
  import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  // Fila de cartas (ESCOPO "Cards"; desenho do D1; ADR 0010).

  let cartas: LinhaCarta[] = [];
  let carregado = false;
  let tentando = '';

  $: idAberto = browser ? $page.url.searchParams.get('carta') : null;
  $: aberta = idAberto ? cartas.find((carta) => carta.id === idAberto) : undefined;
  $: naFila = cartas
    .filter((carta) => carta.state !== 'exportada')
    .sort((a, b) => (a.modified_at < b.modified_at ? 1 : -1));

  async function carregar() {
    cartas = await sincronizador().listar('cartas');
    carregado = true;
  }

  async function tentarDeNovo(carta: LinhaCarta) {
    tentando = carta.id;

    try {
      await geracao.tentarDeNovo(carta.id);
    } catch {
      // O motivo fica na carta.
    } finally {
      tentando = '';
      await carregar();
    }
  }

  const abrir = (id: string) => goto(`${pagePath}/fila?carta=${id}`);
  const voltar = () => goto(`${pagePath}/fila`);

  onMount(() => {
    const assinaturas = [cartasRecebidas$.subscribe(carregar), gerandoAgora$.subscribe(carregar)];

    carregar();
    gerarPendentes();

    return () => assinaturas.forEach((assinatura) => assinatura.unsubscribe());
  });
</script>

<svelte:head>
  <title>{formatPageTitle('Fila de cartas')}</title>
</svelte:head>

<main class="dokusho-fila">
  {#if aberta}
    <EditorCarta carta={aberta} gerando={$gerandoAgora$ === aberta.id} on:voltar={voltar} />
  {:else}
    <header><h1>Fila de cartas</h1></header>

    {#each naFila as carta (carta.id)}
      {@const gerando = $gerandoAgora$ === carta.id || carta.state === 'gerando'}
      <div
        class="dokusho-fila__carta"
        role="button"
        tabindex="0"
        on:click={() => abrir(carta.id)}
        on:keyup={(e) => e.key === 'Enter' && abrir(carta.id)}
      >
        <div class="dokusho-fila__palavra" lang="ja">
          {carta.word}<small>{carta.word_reading}</small>
        </div>
        <span class="dokusho-estado dokusho-estado--{gerando ? 'gerando' : carta.state}">
          {gerando ? 'gerando' : carta.state}
        </span>
        <div class="dokusho-fila__frase" lang="ja">{@html htmlDaFrase(carta.sentence)}</div>
        {#if carta.word_meaning}
          <div class="dokusho-fila__significado">
            {carta.word_meaning}
            {#if carta.word_audio_check === 'confira'}<b class="dokusho-fila__confira"
                >confira a voz</b
              >{/if}
          </div>
        {:else if carta.state === 'pendente'}
          <div class="dokusho-fila__significado dokusho-fila__apagado">
            {$isOnline$ ? 'Na vez para gerar.' : 'Espera a conexão para gerar.'}
          </div>
        {:else if gerando}
          <div class="dokusho-fila__significado dokusho-fila__apagado">
            Gerando significado, tradução e áudio…
          </div>
        {/if}
        {#if carta.state === 'erro'}
          <div class="dokusho-fila__erro">
            <span>{carta.error_reason || 'A geração falhou.'}</span>
            <button
              disabled={tentando === carta.id || !$isOnline$}
              on:click|stopPropagation={() => tentarDeNovo(carta)}>Tentar de novo</button
            >
          </div>
        {/if}
      </div>
    {:else}
      <p class="dokusho-fila__vazia">
        {carregado
          ? 'A fila está vazia. Toque numa palavra no Leitor e escolha "Criar carta".'
          : 'Carregando…'}
      </p>
    {/each}
  {/if}
</main>

<NavegacaoInferior />

<style lang="scss">
  .dokusho-fila {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 18px calc(110px + env(safe-area-inset-bottom, 0px));
    font-family: 'Noto Sans JP', system-ui, sans-serif;
    color: #1b2220;

    header {
      padding: 22px 0 10px;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
    }
  }

  .dokusho-fila__carta {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 10px;
    margin-top: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(20, 32, 28, 0.08);
    cursor: pointer;
  }

  .dokusho-fila__palavra {
    font-size: 20px;
    font-weight: 700;

    small {
      font-size: 13px;
      font-weight: 400;
      color: #59635f;
      margin-left: 6px;
    }
  }

  .dokusho-fila__frase,
  .dokusho-fila__significado,
  .dokusho-fila__erro {
    grid-column: 1 / -1;
  }

  .dokusho-fila__frase {
    font-size: 14px;
    color: #59635f;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    :global(b) {
      color: #2d4f86;
      font-weight: 600;
    }
  }

  .dokusho-fila__significado {
    font-size: 13px;
  }

  .dokusho-fila__apagado {
    color: #8c9591;
  }

  .dokusho-fila__confira {
    margin-left: 6px;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 99px;
    background: #fbefd8;
    color: #a66a12;
  }

  .dokusho-fila__erro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    color: #b93a2e;

    button {
      flex: none;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 8px;
      background: #f8e1dd;

      &:disabled {
        opacity: 0.5;
      }
    }
  }

  .dokusho-fila__vazia {
    padding: 28px 10px;
    text-align: center;
    color: #8c9591;
    font-size: 14px;
  }
</style>
