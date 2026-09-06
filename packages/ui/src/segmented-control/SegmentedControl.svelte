<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SegmentOption } from '../types';

  export let options: (SegmentOption | string)[] = [];
  export let value: string | number = '';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let fullWidth: boolean = false;
  export let disabled: boolean = false;
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{ change: { value: string | number } }>();

  $: normalizedOptions = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt, disabled: false } : opt
  );

  function selectOption(optValue: string | number, optDisabled?: boolean) {
    if (disabled || optDisabled || value === optValue) return;
    value = optValue;
    dispatch('change', { value });
  }
</script>

<div
  role="radiogroup"
  class="astryx-segmented-control {customClass}"
  class:full-width={fullWidth}
  data-size={size}
  {...$$restProps}
>
  {#each normalizedOptions as opt (opt.value)}
    {@const isSelected = value === opt.value}
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={disabled || opt.disabled}
      class="astryx-segment-item"
      class:is-selected={isSelected}
      on:click={() => selectOption(opt.value, opt.disabled)}
    >
      <span class="astryx-segment-label">{opt.label}</span>
    </button>
  {/each}
</div>

<style>
  .astryx-segmented-control {
    display: inline-flex;
    align-items: center;
    padding: var(--astryx-space-0-5, 2px);
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border: 1px solid var(--astryx-color-border-subtle, #e4e4e7);
    border-radius: var(--astryx-radius-md, 6px);
    box-sizing: border-box;
    user-select: none;
    gap: var(--astryx-space-0-5, 2px);
  }

  .full-width {
    display: flex;
    width: 100%;
  }

  /* Sizes */
  [data-size='sm'] {
    height: 30px;
  }
  [data-size='sm'] .astryx-segment-item {
    padding: 0 var(--astryx-space-2, 8px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
    height: 24px;
  }

  [data-size='md'] {
    height: 38px;
  }
  [data-size='md'] .astryx-segment-item {
    padding: 0 var(--astryx-space-3, 12px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
    height: 32px;
  }

  [data-size='lg'] {
    height: 46px;
  }
  [data-size='lg'] .astryx-segment-item {
    padding: 0 var(--astryx-space-4, 16px);
    font-size: var(--astryx-font-size-md, 1rem);
    height: 40px;
  }

  .astryx-segment-item {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: calc(var(--astryx-radius-md, 6px) - 2px);
    color: var(--astryx-color-fg-secondary, #52525b);
    font-family: var(--astryx-font-family-sans, sans-serif);
    font-weight: var(--astryx-font-weight-medium, 500);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
    outline: none;
  }

  .astryx-segment-item:hover:not(:disabled):not(.is-selected) {
    color: var(--astryx-color-fg-primary, #18181b);
  }

  .astryx-segment-item.is-selected {
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-primary, #18181b);
    font-weight: var(--astryx-font-weight-semibold, 600);
    box-shadow: var(--astryx-elevation-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  }

  .astryx-segment-item:focus-visible {
    box-shadow: 0 0 0 2px var(--astryx-color-border-focus, #18181b);
  }

  .astryx-segment-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .astryx-segment-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
