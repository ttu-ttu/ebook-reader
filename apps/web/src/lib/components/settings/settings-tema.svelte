<script lang="ts">
  import { escolherTema, tema$, type Tema } from '$lib/data/tema';

  // Configurações › Data › Aparência: claro, escuro ou como o sistema (o leitor segue o tema do ttu).

  const opcoes: { valor: Tema; rotulo: string }[] = [
    { valor: 'sistema', rotulo: 'Sistema' },
    { valor: 'claro', rotulo: 'Claro' },
    { valor: 'escuro', rotulo: 'Escuro' }
  ];
</script>

<div class="dokusho-tema">
  {#each opcoes as { valor, rotulo }}
    <button class:ativo={$tema$ === valor} on:click={() => escolherTema(valor)}>{rotulo}</button>
  {/each}
</div>

<style lang="scss">
  .dokusho-tema {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 11px;
    background: var(--dk-sunk);

    button {
      min-height: 34px;
      padding: 0 16px;
      border-radius: 9px;
      font-size: 14px;
      color: var(--dk-ink2);

      &.ativo {
        background: var(--dk-surface);
        color: var(--dk-ink);
        box-shadow: 0 1px 3px var(--dk-shadow);
      }
    }
  }
</style>
