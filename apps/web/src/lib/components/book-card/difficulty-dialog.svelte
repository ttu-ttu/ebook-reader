<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import DifficultyPanel from '$lib/components/book-card/difficulty-panel.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { createEventDispatcher } from 'svelte';

  /** Calibre ids of the selected books */
  export let selectedIds: number[] = [];

  const dispatch = createEventDispatcher<{ close: void }>();

  let finishedCompute = false;
</script>

<DialogTemplate>
  <svelte:fragment slot="header">Estimate difficulty</svelte:fragment>
  <div slot="content"><DifficultyPanel {selectedIds} bind:finishedCompute /></div>
  <div slot="footer" class="flex gap-2">
    {#if finishedCompute}
      <button class={buttonClasses} on:click={() => window.location.reload()}>Reload library</button
      >
    {/if}
    <button class={buttonClasses} on:click={() => dispatch('close')}>Close</button>
  </div>
</DialogTemplate>
