<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let pressed: boolean = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled: boolean = false;
  export let value: string | number = '';
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{
    change: { pressed: boolean; value: string | number };
  }>();

  function toggle() {
    if (!disabled) {
      pressed = !pressed;
      dispatch('change', { pressed, value });
    }
  }
</script>

<button
  type="button"
  class="astryx-toggle-button {customClass}"
  class:is-pressed={pressed}
  data-size={size}
  aria-pressed={pressed}
  {disabled}
  on:click={toggle}
  {...$$restProps}
>
  <slot />
</button>

<style>
  .astryx-toggle-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    font-family: var(--astryx-font-family-sans, sans-serif);
    font-weight: var(--astryx-font-weight-medium, 500);
    border-radius: var(--astryx-radius-md, 6px);
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-secondary, #52525b);
    cursor: pointer;
    user-select: none;
    transition:
      background-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      border-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
    outline: none;
  }

  .astryx-toggle-button:focus-visible {
    box-shadow:
      0 0 0 2px var(--astryx-color-surface, #fff),
      0 0 0 4px var(--astryx-color-border-focus, #18181b);
  }

  /* Sizes */
  [data-size='sm'] {
    height: 28px;
    padding: 0 var(--astryx-space-2-5, 10px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
    gap: var(--astryx-space-1, 4px);
  }

  [data-size='md'] {
    height: 36px;
    padding: 0 var(--astryx-space-3, 12px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
    gap: var(--astryx-space-1-5, 6px);
  }

  [data-size='lg'] {
    height: 44px;
    padding: 0 var(--astryx-space-4, 16px);
    font-size: var(--astryx-font-size-md, 1rem);
    gap: var(--astryx-space-2, 8px);
  }

  .astryx-toggle-button:hover:not(:disabled) {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    color: var(--astryx-color-fg-primary, #18181b);
  }

  .astryx-toggle-button.is-pressed {
    background-color: var(--astryx-color-brand-subtle, #f4f4f5);
    border-color: var(--astryx-color-border-strong, #a1a1aa);
    color: var(--astryx-color-fg-primary, #18181b);
    font-weight: var(--astryx-font-weight-semibold, 600);
  }

  .astryx-toggle-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
