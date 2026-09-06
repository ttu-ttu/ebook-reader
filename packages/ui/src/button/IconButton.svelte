<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let label: string;
  export let variant: 'ghost' | 'secondary' | 'primary' | 'subtle' | 'outline' = 'ghost';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let shape: 'rounded' | 'circle' = 'rounded';
  export let disabled: boolean = false;
  export let active: boolean = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  function handleClick(event: MouseEvent) {
    if (!disabled) {
      dispatch('click', event);
    }
  }
</script>

<button
  {type}
  class="astryx-icon-button {customClass}"
  class:is-active={active}
  class:is-circle={shape === 'circle'}
  data-variant={variant}
  data-size={size}
  {disabled}
  aria-label={label}
  title={label}
  on:click={handleClick}
  on:pointerdown
  on:pointerup
  on:contextmenu
  on:keydown
  on:keyup
  on:mouseenter
  on:mouseleave
  on:focus
  on:blur
  {...$$restProps}
>
  <span class="astryx-icon-wrap" aria-hidden="true">
    <slot />
  </span>
</button>

<style>
  .astryx-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    border: 1px solid transparent;
    cursor: pointer;
    user-select: none;
    border-radius: var(--astryx-radius-md, 6px);
    transition:
      background-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      border-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
    outline: none;
  }

  .astryx-icon-button:focus-visible {
    box-shadow:
      0 0 0 2px var(--astryx-color-surface, #fff),
      0 0 0 4px var(--astryx-color-border-focus, #18181b);
  }

  .is-circle {
    border-radius: var(--astryx-radius-full, 9999px);
  }

  /* Sizes */
  [data-size='sm'] {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }

  [data-size='md'] {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  [data-size='lg'] {
    width: 44px;
    height: 44px;
    font-size: 22px;
  }

  /* Variants */
  [data-variant='ghost'] {
    background-color: transparent;
    color: var(--astryx-color-fg-secondary, #52525b);
  }
  [data-variant='ghost']:hover:not(:disabled) {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    color: var(--astryx-color-fg-primary, #18181b);
  }
  [data-variant='ghost']:active:not(:disabled),
  [data-variant='ghost'].is-active {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    color: var(--astryx-color-fg-primary, #18181b);
  }

  [data-variant='subtle'] {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    color: var(--astryx-color-fg-secondary, #52525b);
  }
  [data-variant='subtle']:hover:not(:disabled) {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    color: var(--astryx-color-fg-primary, #18181b);
  }

  [data-variant='secondary'] {
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-primary, #18181b);
    border-color: var(--astryx-color-border-default, #e4e4e7);
  }
  [data-variant='secondary']:hover:not(:disabled) {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: var(--astryx-color-border-hover, #d4d4d8);
  }

  [data-variant='outline'] {
    background-color: transparent;
    color: var(--astryx-color-fg-primary, #18181b);
    border-color: var(--astryx-color-border-default, #e4e4e7);
  }
  [data-variant='outline']:hover:not(:disabled) {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: var(--astryx-color-border-hover, #d4d4d8);
  }

  [data-variant='primary'] {
    background-color: var(--astryx-color-brand, #18181b);
    color: var(--astryx-color-fg-on-brand, #ffffff);
  }
  [data-variant='primary']:hover:not(:disabled) {
    background-color: var(--astryx-color-brand-hover, #27272a);
  }

  .astryx-icon-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .astryx-icon-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>
