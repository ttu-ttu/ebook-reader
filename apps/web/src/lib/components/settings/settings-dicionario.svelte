<script lang="ts">
  import { onMount } from 'svelte';
  import { buttonClasses } from '$lib/css-classes';
  import {
    apagarDicionarioLocal,
    baixarDicionario,
    dataDaVersao,
    estadoDicionario$,
    formatarMb,
    haVersaoNova,
    medirConsultas,
    verificarDicionario
  } from '$lib/data/dicionario/servico';

  // Configurações › Dados › Dicionário: versão e data, baixar, atualizar e apagar (V1.2).

  let versaoNova = false;
  let mensagem = '';
  let medicao = '';

  async function medir() {
    medicao = 'Medindo…';

    const r = await medirConsultas();

    medicao =
      `Tokenizador pronto em ${(r.tempoTokenizador / 1000).toFixed(1)} s. ` +
      `${r.toques} toques (${r.achados} no dicionário): média ${r.media.toFixed(0)} ms, ` +
      `p95 ${r.p95.toFixed(0)} ms, máx ${r.maximo.toFixed(0)} ms (meta: 100 ms).`;
  }

  onMount(async () => {
    await verificarDicionario();

    if (navigator.onLine) {
      versaoNova = await haVersaoNova().catch(() => false);
    }
  });

  async function executar(acao: () => Promise<unknown>) {
    mensagem = '';

    try {
      await acao();
      versaoNova = false;
    } catch (erro) {
      mensagem = erro instanceof Error ? erro.message : String(erro);
    }
  }

  $: estado = $estadoDicionario$;
</script>

<div class="flex flex-col gap-2">
  {#if estado.tipo === 'verificando'}
    <p>Verificando…</p>
  {:else if estado.tipo === 'ausente'}
    <p>Ainda não baixado neste aparelho (baixa no primeiro toque numa palavra).</p>
  {:else if estado.tipo === 'baixando'}
    <p>Baixando {formatarMb(estado.bytes)} de {formatarMb(estado.total)}</p>
  {:else if estado.tipo === 'preparando'}
    <p>Preparando {Math.round(estado.fracao * 100)}%</p>
  {:else if estado.tipo === 'pronto'}
    <p>
      Versão {estado.versao}{dataDaVersao(estado.versao)
        ? `, de ${dataDaVersao(estado.versao)}`
        : ''}
    </p>
    {#if estado.baixadoEm}
      <p class="text-sm opacity-60">
        Baixado em {new Date(estado.baixadoEm).toLocaleDateString('pt-BR')}
      </p>
    {/if}
  {:else if estado.tipo === 'erro'}
    <p>Erro: {estado.mensagem}</p>
  {/if}

  {#if mensagem}
    <p>{mensagem}</p>
  {/if}

  <div class="flex flex-wrap gap-4">
    {#if estado.tipo === 'ausente' || estado.tipo === 'erro' || versaoNova}
      <button class={buttonClasses} on:click={() => executar(baixarDicionario)}>
        {versaoNova && estado.tipo === 'pronto' ? 'Atualizar' : 'Baixar'}
      </button>
    {/if}
    {#if estado.tipo === 'pronto'}
      <button class={buttonClasses} on:click={() => executar(medir)}>Medir velocidade</button>
      <button class={buttonClasses} on:click={() => executar(apagarDicionarioLocal)}>
        Apagar deste aparelho
      </button>
    {/if}
  </div>

  {#if medicao}
    <p class="text-sm">{medicao}</p>
  {/if}
</div>
