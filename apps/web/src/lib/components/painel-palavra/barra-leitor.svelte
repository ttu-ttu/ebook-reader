<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // Barra do topo do leitor (desenho do D1): voltar, título com capítulo e %, Aa, ふ e o menu ⋯. Aparece
  // ao rolar para trás ou ao tocar na faixa do topo; as funções do ttu ficam no menu.

  export let visivel = false;
  export let titulo = '';
  export let capitulo = '';
  export let porcentagem = 0;
  export let furiganaLigado = true;
  export let corFundo = '#fff';
  export let corTexto = 'rgba(0, 0, 0, 0.87)';

  const dispatch = createEventDispatcher<{
    voltar: void;
    tamanho: void;
    furigana: void;
    acao: string;
  }>();

  const ACOES = [
    ['desmarcar', 'Desmarcar a partir daqui'],
    ['sumario', 'Sumário'],
    ['marcador', 'Marcar este ponto'],
    ['irMarcador', 'Ir para o marcador'],
    ['estatisticas', 'Estatísticas'],
    ['configuracoes', 'Opções de leitura'],
    ['ttu', 'Mais ferramentas do leitor']
  ];

  let menu = false;

  $: if (!visivel) menu = false;

  function acao(nome: string) {
    menu = false;
    dispatch('acao', nome);
  }
</script>

<div
  class="dokusho-barra writing-horizontal-tb"
  class:dokusho-barra--visivel={visivel}
  style:--barra-fundo={corFundo}
  style:--barra-texto={corTexto}
>
  <button
    class="dokusho-barra__icone"
    aria-label="Voltar para a Biblioteca"
    on:click={() => dispatch('voltar')}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  </button>
  <div class="dokusho-barra__titulo">
    <b>{titulo}</b>
    <span>{capitulo ? `${capitulo} · ` : ''}{porcentagem}%</span>
  </div>
  <button
    class="dokusho-barra__texto"
    aria-label="Tamanho da letra"
    on:click={() => dispatch('tamanho')}>Aa</button
  >
  <button
    class="dokusho-barra__texto"
    class:ligado={furiganaLigado}
    aria-label="Furigana do livro"
    aria-pressed={furiganaLigado}
    on:click={() => dispatch('furigana')}>ふ</button
  >
  <button
    class="dokusho-barra__icone"
    aria-label="Mais opções"
    aria-expanded={menu}
    on:click={() => (menu = !menu)}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"
      ><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle
        cx="19"
        cy="12"
        r="1.3"
      /></svg
    >
  </button>

  {#if menu}
    <div class="dokusho-barra__menu" role="menu">
      {#each ACOES as [nome, rotulo]}
        <button role="menuitem" on:click={() => acao(nome)}>{rotulo}</button>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .dokusho-barra {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: calc(8px + env(safe-area-inset-top, 0px)) 8px 8px 4px;
    background: var(--barra-fundo);
    color: var(--barra-texto);
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    font-family: 'Noto Sans JP', system-ui, sans-serif;
    transform: translateY(-105%);
    transition: transform 0.22s ease;
  }

  .dokusho-barra--visivel {
    transform: none;
  }

  .dokusho-barra__icone {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    opacity: 0.75;

    svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }

  .dokusho-barra__titulo {
    flex: 1;
    min-width: 0;
    text-align: center;
    line-height: 1.2;

    b {
      display: block;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      font-size: 12px;
      opacity: 0.6;
    }
  }

  .dokusho-barra__texto {
    min-width: 40px;
    height: 40px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 16px;
    opacity: 0.75;

    &.ligado {
      opacity: 1;
      color: #2d4f86;
      background: #e2e8f3;
    }
  }

  .dokusho-barra__menu {
    position: absolute;
    right: 10px;
    top: calc(100% + 4px);
    min-width: 230px;
    padding: 6px;
    border-radius: 14px;
    background: var(--barra-fundo);
    color: var(--barra-texto);
    box-shadow: 0 8px 30px rgba(20, 32, 28, 0.25);

    button {
      display: block;
      width: 100%;
      padding: 12px;
      border-radius: 9px;
      text-align: left;
      font-size: 15px;

      &:active {
        background: rgba(128, 128, 128, 0.15);
      }
    }
  }
</style>
