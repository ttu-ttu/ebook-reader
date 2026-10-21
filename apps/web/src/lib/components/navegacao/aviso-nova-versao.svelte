<script lang="ts">
  import { atualizarAgora, novaVersao$ } from '$lib/data/atualizacao';

  // Aviso "Nova versão: atualizar" (ADR 0011). Só nas telas fora do leitor.
</script>

{#if $novaVersao$}
  <div class="dokusho-nova-versao">
    <span>Nova versão do app</span>
    <button on:click={atualizarAgora}>Atualizar</button>
  </div>
{/if}

<style lang="scss">
  .dokusho-nova-versao {
    position: fixed;
    top: calc(8px + env(safe-area-inset-top, 0px));
    left: 12px;
    right: 12px;
    z-index: 35;
    max-width: 616px;
    margin: 0 auto;
    box-shadow: 0 4px 16px rgba(20, 32, 28, 0.18);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #e2e8f3;
    font-size: 14px;

    button {
      font-weight: 700;
      color: #2d4f86;
    }
  }
</style>
