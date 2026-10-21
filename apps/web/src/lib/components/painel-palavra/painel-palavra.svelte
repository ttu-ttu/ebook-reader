<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Entrada } from '$lib/data/dicionario/formato';
  import type { Selecao } from '$lib/data/dicionario/busca';
  import { formaDaEntrada } from '$lib/data/cartas/palavra';
  import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';

  // Painel da palavra (ESCOPO "Toque e painel"; desenho do D1): inferior no celular, lateral na
  // tela larga. Só mostra; o leitor (leitor-dokusho.svelte) decide o que cada botão faz.

  export let selecao: Selecao | undefined;
  export let entradas: Entrada[] = [];
  export let indiceEntrada = 0;
  /** Leitura do furigana do EPUB sobre a seleção. */
  export let rubi: string | undefined = undefined;
  export let carregando = '';
  export let cartas: LinhaCarta[] = [];
  export let traducao: { frase: string; texto: string; cache: boolean } | undefined = undefined;
  export let traduzindo = false;
  export let erro = '';
  export let online = true;
  export let podeEncurtar = false;
  export let podeAlongar = false;
  export let confirmarDuplicada = false;
  export let corFundo = '#fff';
  export let corTexto = 'rgba(0, 0, 0, 0.87)';
  /** Na tela larga, o painel fica do lado oposto ao da palavra tocada. */
  export let aEsquerda = false;

  const dispatch = createEventDispatcher<{
    encurtar: void;
    alongar: void;
    entrada: number;
    fechar: void;
    traduzir: void;
    criarCarta: { mesmoAssim: boolean };
    abrirCarta: string;
  }>();

  let arrasto: { y0: number; dy: number } | undefined;
  let deslocamento = 0;

  $: entrada = entradas[Math.min(indiceEntrada, entradas.length - 1)];
  $: palavra = entrada && selecao ? formaDaEntrada(entrada, selecao.termo, rubi) : undefined;
  $: naFila = cartas.find((carta) => carta.state !== 'exportada');
  $: exportada = cartas.find((carta) => carta.state === 'exportada');
  $: leituraDaEntrada = (e: Entrada) =>
    (selecao && formaDaEntrada(e, selecao.termo, rubi).leitura) || e.formas[0]?.l;

  function inicioArrasto(evento: PointerEvent) {
    arrasto = { y0: evento.clientY, dy: 0 };
    (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
  }

  function moverArrasto(evento: PointerEvent) {
    if (!arrasto) return;
    arrasto.dy = Math.max(0, evento.clientY - arrasto.y0);
    deslocamento = arrasto.dy;
  }

  function fimArrasto() {
    if (!arrasto) return;
    const fechar = arrasto.dy > 70;
    arrasto = undefined;
    deslocamento = 0;
    if (fechar) dispatch('fechar');
  }

  const dataCurta = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
</script>

<aside
  class="dokusho-painel writing-horizontal-tb"
  class:dokusho-painel--esquerda={aEsquerda}
  style:--painel-fundo={corFundo}
  style:--painel-texto={corTexto}
  style:transform={deslocamento ? `translateY(${deslocamento}px)` : undefined}
  aria-live="polite"
>
  <div
    class="dokusho-painel__alca"
    role="presentation"
    on:pointerdown={inicioArrasto}
    on:pointermove={moverArrasto}
    on:pointerup={fimArrasto}
    on:pointercancel={fimArrasto}
  >
    <div />
  </div>

  <div class="dokusho-painel__corpo">
    <div class="dokusho-painel__cabeca">
      <button
        class="dokusho-painel__seta"
        disabled={!podeEncurtar}
        aria-label="Encurtar a seleção"
        on:click={() => dispatch('encurtar')}>‹</button
      >
      <div class="dokusho-painel__palavra">
        <div class="dokusho-painel__leitura">{palavra?.leitura ?? ' '}</div>
        <div class="dokusho-painel__escrita" lang="ja">
          {palavra?.escrita ?? selecao?.texto ?? ''}
        </div>
        {#if selecao && palavra && selecao.texto !== palavra.escrita}
          <div class="dokusho-painel__selecao" lang="ja">
            seleção: {selecao.texto} → {palavra.escrita}
          </div>
        {/if}
      </div>
      <button
        class="dokusho-painel__seta"
        disabled={!podeAlongar}
        aria-label="Alongar a seleção"
        on:click={() => dispatch('alongar')}>›</button
      >
    </div>

    {#if carregando}
      <p class="dokusho-painel__aviso">{carregando}</p>
    {:else if selecao}
      {#if entradas.length > 1}
        <div class="dokusho-painel__entradas">
          {#each entradas as e, i}
            <button
              class:dokusho-ativo={i === indiceEntrada}
              lang="ja"
              on:click={() => dispatch('entrada', i)}
            >
              {leituraDaEntrada(e)}{#if rubi && e.formas.some((f) => f.l === rubi)}<small
                  >furigana do livro</small
                >{/if}
            </button>
          {/each}
        </div>
      {/if}

      {#if entrada}
        <ol class="dokusho-painel__glosas">
          {#each entrada.sentidos.slice(0, 6) as sentido}
            <li>
              {#if sentido.t.length}<span class="dokusho-painel__etiqueta"
                  >{sentido.t.join(', ')}</span
                >{/if}
              {sentido.g.join('; ')}
            </li>
          {/each}
        </ol>
        <div class="dokusho-painel__meta">
          {#if palavra?.frequencia}JPDB {palavra.frequencia.toLocaleString('pt-BR')}{/if}
          {#if entradas.length > 1}· {entradas.length} entradas; a carta usa a aberta{/if}
        </div>
      {:else}
        <div class="dokusho-painel__fora">
          Não está no dicionário.<br /><small>Nomes próprios em katakana costumam cair aqui.</small>
        </div>
      {/if}

      <div class="dokusho-painel__linha">
        {#if selecao.gramatica}
          <span class="dokusho-painel__marca">gramática · fora da cobertura</span>
        {:else}
          <span />
        {/if}
        <button
          class="dokusho-painel__traduzir"
          disabled={!online || traduzindo}
          on:click={() => dispatch('traduzir')}
        >
          {#if !online}Traduzir frase · sem conexão{:else if traduzindo}Traduzindo…{:else}Traduzir
            frase{/if}
        </button>
      </div>

      {#if naFila}
        <div class="dokusho-painel__fila">Na fila · {naFila.state}</div>
      {:else if exportada}
        <div class="dokusho-painel__fila">Exportada em {dataCurta(exportada.modified_at)}</div>
      {/if}

      {#if traducao}
        <div class="dokusho-painel__traducao">
          <div lang="ja">{traducao.frase}</div>
          {traducao.texto}{#if traducao.cache}<small> (do cache)</small>{/if}
        </div>
      {/if}

      {#if erro}
        <p class="dokusho-painel__erro">{erro}</p>
      {/if}

      {#if confirmarDuplicada && exportada}
        <div class="dokusho-painel__confirmar">
          Esta palavra já foi exportada em {dataCurta(exportada.modified_at)}. Uma carta nova
          sobrescreve o Card no Anki quando importada.
          <div>
            <button on:click={() => dispatch('fechar')}>Cancelar</button>
            <button
              class="dokusho-primario"
              on:click={() => dispatch('criarCarta', { mesmoAssim: true })}
              >Criar mesmo assim</button
            >
          </div>
        </div>
      {/if}

      <div class="dokusho-painel__acoes">
        <button disabled title="Chega na v2">Já sei <small>v2</small></button>
        {#if naFila}
          <button on:click={() => dispatch('abrirCarta', naFila?.id ?? '')}>Na fila · abrir</button>
        {:else}
          <button
            class="dokusho-primario"
            on:click={() => dispatch('criarCarta', { mesmoAssim: false })}>Criar carta</button
          >
        {/if}
      </div>
    {/if}
  </div>
</aside>

<style lang="scss">
  .dokusho-painel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    max-height: 64vh;
    display: flex;
    flex-direction: column;
    background: var(--painel-fundo);
    color: var(--painel-texto);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -6px 30px rgba(20, 32, 28, 0.25);
    font-family: 'Noto Sans JP', system-ui, sans-serif;
    font-size: 15px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    transition: transform 0.2s ease;

    @media (min-width: 768px) {
      left: auto;
      top: 0;
      width: 360px;
      max-height: none;
      border-radius: 0;
      box-shadow: -6px 0 30px rgba(20, 32, 28, 0.25);
    }
  }

  @media (min-width: 768px) {
    .dokusho-painel--esquerda {
      left: 0;
      right: auto;
      box-shadow: 6px 0 30px rgba(20, 32, 28, 0.25);
    }
  }

  .dokusho-painel__alca {
    touch-action: none;
    padding: 8px 0 0;
    cursor: grab;

    div {
      width: 40px;
      height: 5px;
      border-radius: 3px;
      background: currentColor;
      opacity: 0.2;
      margin: 0 auto 6px;
    }

    @media (min-width: 768px) {
      display: none;
    }
  }

  .dokusho-painel__corpo {
    overflow-y: auto;
    padding: 4px 18px 18px;

    @media (min-width: 768px) {
      padding-top: 18px;
    }
  }

  .dokusho-painel__cabeca {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    gap: 4px;
  }

  .dokusho-painel__seta {
    width: 48px;
    height: 56px;
    border-radius: 12px;
    font-size: 28px;
    line-height: 1;
    background: rgba(128, 128, 128, 0.12);

    &:disabled {
      opacity: 0.3;
    }
  }

  .dokusho-painel__palavra {
    text-align: center;
    min-width: 0;
  }

  .dokusho-painel__leitura {
    font-size: 14px;
    opacity: 0.7;
    letter-spacing: 0.05em;
  }

  .dokusho-painel__escrita {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.2;
    word-break: break-all;
  }

  .dokusho-painel__selecao,
  .dokusho-painel__meta {
    font-size: 12px;
    opacity: 0.55;
    margin-top: 4px;
  }

  .dokusho-painel__entradas {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 10px;

    button {
      padding: 5px 11px;
      border-radius: 99px;
      font-size: 14px;
      box-shadow: inset 0 0 0 1.5px rgba(128, 128, 128, 0.35);
    }

    .dokusho-ativo {
      color: #2d4f86;
      background: #e2e8f3;
      box-shadow: inset 0 0 0 1.5px #2d4f86;
    }

    small {
      font-size: 10px;
      margin-left: 4px;
    }
  }

  .dokusho-painel__glosas {
    margin: 12px 0 0;
    padding-left: 20px;
    list-style: decimal;
    line-height: 1.5;
  }

  .dokusho-painel__etiqueta {
    font-size: 11px;
    opacity: 0.55;
    margin-right: 4px;
  }

  .dokusho-painel__fora,
  .dokusho-painel__aviso {
    margin-top: 12px;
    padding: 12px;
    border-radius: 12px;
    background: rgba(128, 128, 128, 0.12);
    text-align: center;
    font-size: 14px;
  }

  .dokusho-painel__linha {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 14px;
    flex-wrap: wrap;
  }

  .dokusho-painel__marca {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 99px;
    background: rgba(128, 128, 128, 0.15);
    opacity: 0.8;
  }

  .dokusho-painel__traduzir {
    min-height: 36px;
    padding: 0 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    color: #2d4f86;
    box-shadow: inset 0 0 0 1.5px #e2e8f3;

    &:disabled {
      color: inherit;
      opacity: 0.5;
    }
  }

  .dokusho-painel__fila {
    font-size: 13px;
    color: #2d4f86;
    font-weight: 500;
    margin-top: 8px;
  }

  .dokusho-painel__traducao {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(128, 128, 128, 0.12);
    font-size: 14px;
    line-height: 1.5;

    div {
      font-size: 13px;
      opacity: 0.7;
    }

    small {
      opacity: 0.6;
    }
  }

  .dokusho-painel__erro {
    margin-top: 10px;
    color: #b93a2e;
    font-size: 14px;
  }

  .dokusho-painel__confirmar {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #fbefd8;
    color: #1b2220;
    font-size: 14px;

    div {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    button {
      flex: 1;
      min-height: 40px;
      border-radius: 10px;
      background: rgba(128, 128, 128, 0.15);
      font-weight: 700;
    }
  }

  .dokusho-painel__acoes {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 10px;
    margin-top: 16px;

    button {
      min-height: 44px;
      border-radius: 12px;
      font-weight: 700;
      box-shadow: inset 0 0 0 1.5px rgba(128, 128, 128, 0.35);

      &:disabled {
        opacity: 0.45;
      }
    }

    small {
      font-size: 10px;
      opacity: 0.7;
    }
  }

  .dokusho-primario {
    background: #2d4f86 !important;
    color: #fff;
    box-shadow: none !important;
  }
</style>
