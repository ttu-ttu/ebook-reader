<script lang="ts">
  import { cartasExportaveis, estimarBytes } from '$lib/data/cartas/exportar';
  import { confirmarLote, prepararLote, type LotePronto } from '$lib/data/cartas/lotes';
  import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';
  import { entregarArquivo } from '$lib/functions/anki/entregar-arquivo';

  // "Exportar .apkg" fixo embaixo da aba "Na fila" (D1; ESCOPO "Regras da fila"). Em dois toques: o
  // primeiro monta o arquivo; o segundo entrega (o Safari só aceita a folha de compartilhamento logo
  // depois de um toque, R1).

  export let cartas: LinhaCarta[];

  const AVISO_ACIMA_DE = 100;

  const cartasTexto = (n: number) => `${n} ${n === 1 ? 'carta' : 'cartas'}`;

  let incluirErro = false;
  let preparando = '';
  let pronto: LotePronto | undefined;
  let mensagem = '';

  $: exportaveis = cartasExportaveis(cartas, incluirErro);
  $: comErro = cartas.some((carta) => carta.state === 'erro' && !carta.lote_id);
  $: megas = (estimarBytes(exportaveis) / 1e6).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  });
  $: podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.canShare;

  async function preparar() {
    mensagem = '';
    preparando = 'Preparando…';

    try {
      pronto = await prepararLote(incluirErro, (texto) => (preparando = texto));
    } catch (e) {
      mensagem = e instanceof Error ? e.message : String(e);
    } finally {
      preparando = '';
    }
  }

  async function entregar() {
    if (!pronto) return;

    try {
      const resultado = await entregarArquivo(pronto.arquivo, pronto.nome);

      if (resultado === 'cancelado') return;

      await confirmarLote(pronto);
      mensagem = `Lote exportado: ${cartasTexto(pronto.cartas.length)}. Importe no Anki num lugar só.`;
      pronto = undefined;
    } catch (e) {
      mensagem = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<div class="dokusho-exportar">
  {#if pronto}
    <p>
      {cartasTexto(pronto.cartas.length)} · {(pronto.arquivo.size / 1e6).toLocaleString('pt-BR', {
        maximumFractionDigits: 1
      })} MB{pronto.semAudio ? ` · ${pronto.semAudio} áudios faltando` : ''}
    </p>
    <div class="dokusho-exportar__botoes">
      <button on:click={() => (pronto = undefined)}>Cancelar</button>
      <button class="dokusho-exportar__principal" on:click={entregar}>
        {podeCompartilhar ? 'Compartilhar com o Anki' : 'Baixar .apkg'}
      </button>
    </div>
  {:else}
    {#if comErro}
      <label class="dokusho-exportar__erro">
        <input type="checkbox" bind:checked={incluirErro} />
        Incluir a carta com erro (sem o áudio que faltou)
      </label>
    {/if}
    {#if exportaveis.length > AVISO_ACIMA_DE}
      <p class="dokusho-exportar__aviso">
        Lote grande ({exportaveis.length} cartas): pode demorar e passar de 30 MB.
      </p>
    {/if}
    <button
      class="dokusho-exportar__principal"
      disabled={!exportaveis.length || !!preparando}
      on:click={preparar}
    >
      {preparando ||
        (exportaveis.length
          ? `Exportar .apkg · ${cartasTexto(exportaveis.length)} · ~${megas} MB`
          : 'Exportar .apkg · nenhuma carta gerada')}
    </button>
  {/if}
  {#if mensagem}
    <p class="dokusho-exportar__mensagem">{mensagem}</p>
  {/if}
</div>

<style lang="scss">
  .dokusho-exportar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(58px + env(safe-area-inset-bottom, 0px));
    z-index: 25;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 18px;
    background: #fff;
    border-top: 1px solid #dce1de;
    font-family: 'Noto Sans JP', system-ui, sans-serif;
    font-size: 14px;

    button {
      min-height: 44px;
      border-radius: 12px;
      font-weight: 700;
      background: #edf0ee;

      &:disabled {
        opacity: 0.45;
      }
    }
  }

  .dokusho-exportar__principal {
    background: #2d4f86 !important;
    color: #fff;
  }

  .dokusho-exportar__botoes {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
  }

  .dokusho-exportar__erro {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #59635f;
  }

  .dokusho-exportar__aviso {
    color: #a66a12;
  }

  .dokusho-exportar__mensagem {
    color: #59635f;
  }
</style>
