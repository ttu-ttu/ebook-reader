<script lang="ts">
  import { prepararLoteDeNovo, type LotePronto } from '$lib/data/cartas/lotes';
  import { sincronizador } from '$lib/data/supabase/sincronizacao/iniciar';
  import type { LinhaCarta, LinhaLote } from '$lib/data/supabase/sincronizacao/regras';
  import { entregarArquivo } from '$lib/functions/anki/entregar-arquivo';

  // Aba "Lotes" da Fila (D1): data e aparelho de cada Lote, as cartas dele e "Baixar este Lote de
  // novo", com aviso quando é outro aparelho (importe cada Lote num lugar só).

  export let lotes: LinhaLote[];
  export let cartas: LinhaCarta[];

  let aberto = '';
  let preparando = '';
  let pronto: LotePronto | undefined;
  let confirmarOutroAparelho = '';
  let mensagem = '';

  $: ordenados = [...lotes].sort((a, b) => (a.exported_at < b.exported_at ? 1 : -1));

  const doLote = (lote: LinhaLote) => cartas.filter((carta) => carta.lote_id === lote.id);
  const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  async function baixarDeNovo(lote: LinhaLote, confirmado = false) {
    if (!confirmado && lote.device_id !== sincronizador().aparelho.id) {
      confirmarOutroAparelho = lote.id;
      return;
    }

    confirmarOutroAparelho = '';
    mensagem = '';
    preparando = lote.id;

    try {
      pronto = await prepararLoteDeNovo(lote);
    } catch (e) {
      mensagem = e instanceof Error ? e.message : String(e);
    } finally {
      preparando = '';
    }
  }

  async function entregar() {
    if (!pronto) return;

    try {
      await entregarArquivo(pronto.arquivo, pronto.nome);
      pronto = undefined;
    } catch (e) {
      mensagem = e instanceof Error ? e.message : String(e);
    }
  }
</script>

{#each ordenados as lote (lote.id)}
  {@const daqui = doLote(lote)}
  <div class="dokusho-lote">
    <button
      class="dokusho-lote__cabeca"
      on:click={() => (aberto = aberto === lote.id ? '' : lote.id)}
    >
      <span>
        <b>{data(lote.exported_at)}</b>
        <small
          >{lote.device_name ?? 'outro aparelho'} · {daqui.length}
          {daqui.length === 1 ? 'carta' : 'cartas'}</small
        >
      </span>
      {#if lote.audio_deleted_at}<small>áudio fora da nuvem</small>{/if}
    </button>
    {#if aberto === lote.id}
      <div class="dokusho-lote__corpo">
        {#each daqui as carta}
          <div class="dokusho-lote__carta" lang="ja">
            {carta.word}<small>{carta.word_reading}</small>
          </div>
        {/each}
        {#if confirmarOutroAparelho === lote.id}
          <div class="dokusho-lote__aviso">
            Este Lote foi baixado no {lote.device_name ?? 'outro aparelho'} em {data(
              lote.exported_at
            )}. Importe cada Lote num lugar só.
            <button on:click={() => baixarDeNovo(lote, true)}>Baixar mesmo assim</button>
          </div>
        {/if}
        {#if pronto?.lote.id === lote.id}
          <button class="dokusho-lote__principal" on:click={entregar}>
            Compartilhar ou baixar ({(pronto.arquivo.size / 1e6).toLocaleString('pt-BR', {
              maximumFractionDigits: 1
            })} MB)
          </button>
        {:else}
          <button disabled={preparando === lote.id} on:click={() => baixarDeNovo(lote)}>
            {preparando === lote.id ? 'Preparando…' : 'Baixar este Lote de novo'}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <p class="dokusho-lote__vazio">Nenhum Lote exportado ainda.</p>
{/each}

{#if mensagem}
  <p class="dokusho-lote__mensagem">{mensagem}</p>
{/if}

<style lang="scss">
  .dokusho-lote {
    margin-top: 10px;
    border-radius: 14px;
    background: var(--dk-surface);
    overflow: hidden;
    box-shadow: 0 1px 3px var(--dk-shadow);

    button {
      min-height: 40px;
      border-radius: 10px;
      font-weight: 700;
      background: var(--dk-sunk);
      padding: 0 12px;

      &:disabled {
        opacity: 0.5;
      }
    }

    small {
      display: block;
      font-size: 13px;
      color: var(--dk-ink2);
    }
  }

  .dokusho-lote__cabeca {
    display: flex !important;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 14px !important;
    text-align: left;
    background: none !important;
    border-radius: 0 !important;
  }

  .dokusho-lote__corpo {
    border-top: 1px solid var(--dk-line);
    padding: 4px 14px 14px;
  }

  .dokusho-lote__carta {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 8px 0;
    border-bottom: 1px solid var(--dk-line);

    small {
      display: inline !important;
    }
  }

  .dokusho-lote__aviso {
    margin: 10px 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--dk-warn-soft);
    font-size: 14px;

    button {
      display: block;
      margin-top: 8px;
    }
  }

  .dokusho-lote__principal {
    background: var(--dk-accent) !important;
    color: var(--dk-accent-ink);
    margin-top: 10px;
  }

  .dokusho-lote__vazio,
  .dokusho-lote__mensagem {
    padding: 28px 10px;
    text-align: center;
    color: var(--dk-ink3);
    font-size: 14px;
  }
</style>
