<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: 'surface' | 'card' | 'flat' | 'elevated' = 'surface';
  export let elevation: 'none' | 'sm' | 'md' | 'lg' = 'none';
  export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  export let radius: 'sm' | 'md' | 'lg' = 'md';
  export let interactive: boolean = false;
  export let selected: boolean = false;
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  function handleClick(event: MouseEvent) {
    if (interactive) {
      dispatch('click', event);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      dispatch('click', event as unknown as MouseEvent);
    }
  }
</script>

{#if interactive}
  <div
    class="astryx-card {customClass}"
    class:is-interactive={true}
    class:is-selected={selected}
    data-variant={variant}
    data-elevation={elevation}
    data-padding={padding}
    data-radius={radius}
    role="button"
    tabindex="0"
    on:click={handleClick}
    on:keydown={handleKeyDown}
    {...$$restProps}
  >
    <slot />
  </div>
{:else}
  <div
    class="astryx-card {customClass}"
    class:is-selected={selected}
    data-variant={variant}
    data-elevation={elevation}
    data-padding={padding}
    data-radius={radius}
    {...$$restProps}
  >
    <slot />
  </div>
{/if}

<style>
  .astryx-card {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-primary, #18181b);
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    font-family: var(--astryx-font-family-sans, sans-serif);
    transition:
      background-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      border-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      transform var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
    outline: none;
  }

  /* Padding */
  [data-padding='none'] {
    padding: 0;
  }
  [data-padding='sm'] {
    padding: var(--astryx-space-2-5, 10px);
  }
  [data-padding='md'] {
    padding: var(--astryx-space-4, 16px);
  }
  [data-padding='lg'] {
    padding: var(--astryx-space-6, 24px);
  }

  /* Radius */
  [data-radius='sm'] {
    border-radius: var(--astryx-radius-sm, 4px);
  }
  [data-radius='md'] {
    border-radius: var(--astryx-radius-md, 6px);
  }
  [data-radius='lg'] {
    border-radius: var(--astryx-radius-lg, 10px);
  }

  /* Variants */
  [data-variant='flat'] {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: transparent;
  }

  [data-variant='card'] {
    background-color: var(--astryx-color-surface, #ffffff);
    box-shadow: var(--astryx-elevation-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  }

  [data-variant='elevated'] {
    background-color: var(--astryx-color-surface-elevated, #ffffff);
    box-shadow: var(--astryx-elevation-md, 0 4px 6px -1px rgba(0, 0, 0, 0.08));
  }

  /* Explicit Elevations */
  [data-elevation='sm'] {
    box-shadow: var(--astryx-elevation-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  }
  [data-elevation='md'] {
    box-shadow: var(--astryx-elevation-md, 0 4px 6px -1px rgba(0, 0, 0, 0.08));
  }
  [data-elevation='lg'] {
    box-shadow: var(--astryx-elevation-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
  }

  /* Interactive State */
  .is-interactive {
    cursor: pointer;
    user-select: none;
  }
  .is-interactive:hover {
    border-color: var(--astryx-color-border-hover, #d4d4d8);
    box-shadow: var(--astryx-elevation-md, 0 4px 6px -1px rgba(0, 0, 0, 0.08));
    transform: translateY(-1px);
  }
  .is-interactive:active {
    transform: translateY(0);
  }
  .is-interactive:focus-visible {
    box-shadow:
      0 0 0 2px var(--astryx-color-surface, #fff),
      0 0 0 4px var(--astryx-color-border-focus, #18181b);
  }

  .is-selected {
    border-color: var(--astryx-color-brand, #18181b);
    box-shadow: 0 0 0 1px var(--astryx-color-brand, #18181b);
  }
</style>
