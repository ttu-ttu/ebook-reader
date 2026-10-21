<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import {
    baixarDicionario,
    estadoDicionario$,
    formatarMb,
    infoDoDownload
  } from '$lib/data/dicionario/servico';

  // Primeiro toque sem dicionário no aparelho: aviso de tamanho e download (V1.2; ADR 0004).

  export let resolver: (pronto: boolean) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let tamanho = '';
  let erro = '';
  let baixando = false;

  onMount(async () => {
    if (!navigator.onLine) {
      erro = 'Sem conexão. O dicionário precisa ser baixado uma vez, com internet.';
      return;
    }

    try {
      tamanho = formatarMb((await infoDoDownload()).bytes);
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
  });

  async function baixar() {
    baixando = true;
    erro = '';

    try {
      await baixarDicionario();
      fechar(true);
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
      baixando = false;
    }
  }

  function fechar(pronto: boolean) {
    resolver(pronto);
    dispatch('close');
  }

  $: estado = $estadoDicionario$;
  $: progresso =
    estado.tipo === 'baixando'
      ? `Baixando ${formatarMb(estado.bytes)} de ${formatarMb(estado.total)}`
      : estado.tipo === 'preparando'
        ? `Preparando ${Math.round(estado.fracao * 100)}%`
        : baixando
          ? 'Carregando o tokenizador…'
          : '';
</script>

<DialogTemplate>
  <svelte:fragment slot="header">Dicionário</svelte:fragment>
  <svelte:fragment slot="content">
    <div class="max-w-sm">
      {#if erro}
        <p>{erro}</p>
      {:else if baixando}
        <p>{progresso}</p>
        <p class="mt-2 text-sm opacity-60">Pode continuar lendo; não feche o app.</p>
      {:else}
        <p>
          O dicionário ainda não está neste aparelho. Baixar agora{tamanho ? ` (${tamanho})` : ''}?
        </p>
        <p class="mt-2 text-sm opacity-60">Baixa uma vez só; depois funciona sem internet.</p>
      {/if}
    </div>
  </svelte:fragment>
  <div class="flex grow justify-between" slot="footer">
    <button class={buttonClasses} disabled={baixando} on:click={() => fechar(false)}>
      {erro ? 'Fechar' : 'Agora não'}
      <Ripple />
    </button>
    <button class={buttonClasses} disabled={baixando || (!tamanho && !erro)} on:click={baixar}>
      {erro ? 'Tentar de novo' : 'Baixar'}
      <Ripple />
    </button>
  </div>
</DialogTemplate>
