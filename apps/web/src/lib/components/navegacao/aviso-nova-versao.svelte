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
    box-shadow: 0 4px 16px var(--dk-shadow);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--dk-accent-soft);
    font-size: 14px;

    button {
      font-weight: 700;
      color: var(--dk-accent);
    }
  }
</style>
