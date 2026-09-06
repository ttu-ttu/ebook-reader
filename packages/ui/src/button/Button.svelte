<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' = 'secondary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let elevation: 'none' | 'sm' | 'md' = 'none';
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let fullWidth: boolean = false;
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  function handleClick(event: MouseEvent) {
    if (!disabled && !loading) {
      dispatch('click', event);
    }
  }
</script>

<button
  {type}
  class="astryx-button {customClass}"
  class:full-width={fullWidth}
  class:is-loading={loading}
  data-variant={variant}
  data-size={size}
  data-elevation={elevation}
  disabled={disabled || loading}
  aria-busy={loading}
  on:click={handleClick}
  {...$$restProps}
>
  {#if loading}
    <span class="astryx-spinner" aria-hidden="true"></span>
  {/if}
  <span class="astryx-button-content" class:content-hidden={loading}>
    {#if $$slots.prefix}
      <span class="astryx-button-prefix"><slot name="prefix" /></span>
    {/if}
    <slot />
    {#if $$slots.suffix}
      <span class="astryx-button-suffix"><slot name="suffix" /></span>
    {/if}
  </span>
</button>

<style>
  .astryx-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    font-family: var(--astryx-font-family-sans, sans-serif);
    font-weight: var(--astryx-font-weight-medium, 500);
    line-height: 1;
    border-radius: var(--astryx-radius-md, 6px);
    border: 1px solid transparent;
    cursor: pointer;
    user-select: none;
    text-decoration: none;
    vertical-align: middle;
    white-space: nowrap;
    transition:
      background-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      border-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      transform var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      opacity var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
    outline: none;
  }

  .astryx-button:focus-visible {
    box-shadow:
      0 0 0 2px var(--astryx-color-surface, #fff),
      0 0 0 4px var(--astryx-color-border-focus, #18181b);
  }

  .full-width {
    width: 100%;
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

  /* Variants */
  [data-variant='primary'] {
    background-color: var(--astryx-color-brand, #18181b);
    color: var(--astryx-color-fg-on-brand, #ffffff);
    border-color: var(--astryx-color-brand, #18181b);
  }
  [data-variant='primary']:hover:not(:disabled) {
    background-color: var(--astryx-color-brand-hover, #27272a);
    border-color: var(--astryx-color-brand-hover, #27272a);
  }
  [data-variant='primary']:active:not(:disabled) {
    background-color: var(--astryx-color-brand-active, #09090b);
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
  [data-variant='secondary']:active:not(:disabled) {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
  }

  [data-variant='ghost'] {
    background-color: transparent;
    color: var(--astryx-color-fg-secondary, #52525b);
    border-color: transparent;
  }
  [data-variant='ghost']:hover:not(:disabled) {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    color: var(--astryx-color-fg-primary, #18181b);
  }
  [data-variant='ghost']:active:not(:disabled) {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
  }

  [data-variant='outline'] {
    background-color: transparent;
    color: var(--astryx-color-fg-primary, #18181b);
    border-color: var(--astryx-color-border-strong, #a1a1aa);
  }
  [data-variant='outline']:hover:not(:disabled) {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: var(--astryx-color-fg-primary, #18181b);
  }

  [data-variant='danger'] {
    background-color: var(--astryx-color-danger, #ef4444);
    color: #ffffff;
    border-color: var(--astryx-color-danger, #ef4444);
  }
  [data-variant='danger']:hover:not(:disabled) {
    background-color: var(--astryx-color-danger-hover, #dc2626);
    border-color: var(--astryx-color-danger-hover, #dc2626);
  }

  /* Elevations */
  [data-elevation='sm'] {
    box-shadow: var(--astryx-elevation-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  }
  [data-elevation='md'] {
    box-shadow: var(--astryx-elevation-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
  }

  /* Disabled State */
  .astryx-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .astryx-button-content {
    display: inline-flex;
    align-items: center;
    gap: inherit;
  }

  .content-hidden {
    visibility: hidden;
  }

  .astryx-spinner {
    position: absolute;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: astryx-spin 0.6s linear infinite;
  }

  @keyframes astryx-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
