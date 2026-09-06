<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  export let variant: 'plain' | 'card' | 'bordered' = 'plain';
  export let divided: boolean = true;
  export let density: 'compact' | 'normal' | 'relaxed' = 'normal';
  let customClass: string = '';
  export { customClass as class };

  const listContext = writable({ density, divided });
  $: listContext.set({ density, divided });
  setContext('astryx-list', listContext);
</script>

<ul
  role="list"
  class="astryx-list {customClass}"
  data-variant={variant}
  data-density={density}
  class:is-divided={divided}
  {...$$restProps}
>
  <slot />
</ul>

<style>
  .astryx-list {
    list-style: none;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    width: 100%;
    font-family: var(--astryx-font-family-sans, sans-serif);
  }

  /* Variants */
  [data-variant='card'] {
    background-color: var(--astryx-color-surface, #ffffff);
    border-radius: var(--astryx-radius-lg, 10px);
    box-shadow: var(--astryx-elevation-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    overflow: hidden;
  }

  [data-variant='bordered'] {
    background-color: var(--astryx-color-surface, #ffffff);
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    border-radius: var(--astryx-radius-md, 6px);
    overflow: hidden;
  }

  /* Divided items */
  .is-divided > :global(.astryx-list-item:not(:last-child)) {
    border-bottom: 1px solid var(--astryx-color-border-subtle, #f4f4f5);
  }
</style>
