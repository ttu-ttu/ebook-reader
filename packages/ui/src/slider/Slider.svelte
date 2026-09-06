<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: number = 50;
  export let min: number = 0;
  export let max: number = 100;
  export let step: number = 1;
  export let disabled: boolean = false;
  export let label: string = '';
  export let showValue: boolean = true;
  export let valueFormatter: (val: number) => string = (val) => String(val);
  export let size: 'sm' | 'md' | 'lg' = 'md';
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{
    input: { value: number };
    change: { value: number };
  }>();

  $: percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = Number(target.value);
    dispatch('input', { value });
  }

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    value = Number(target.value);
    dispatch('change', { value });
  }
</script>

<div class="astryx-slider-container {customClass}" class:is-disabled={disabled} data-size={size}>
  {#if label || showValue}
    <div class="astryx-slider-header">
      {#if label}
        <label for="astryx-slider-input" class="astryx-slider-label">{label}</label>
      {/if}
      {#if showValue}
        <span class="astryx-slider-value">{valueFormatter(value)}</span>
      {/if}
    </div>
  {/if}

  <div class="astryx-slider-track-wrap">
    <div class="astryx-slider-track">
      <div class="astryx-slider-fill" style="width: {percentage}%"></div>
    </div>
    <input
      id="astryx-slider-input"
      type="range"
      {min}
      {max}
      {step}
      {value}
      {disabled}
      class="astryx-slider-native"
      on:input={handleInput}
      on:change={handleChange}
      {...$$restProps}
    />
  </div>
</div>

<style>
  .astryx-slider-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    font-family: var(--astryx-font-family-sans, sans-serif);
    gap: var(--astryx-space-1-5, 6px);
  }

  .astryx-slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }

  .astryx-slider-label {
    color: var(--astryx-color-fg-primary, #18181b);
    font-weight: var(--astryx-font-weight-medium, 500);
  }

  .astryx-slider-value {
    color: var(--astryx-color-fg-secondary, #71717a);
    font-variant-numeric: tabular-nums;
  }

  .astryx-slider-track-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 24px;
  }

  .astryx-slider-track {
    position: absolute;
    width: 100%;
    height: 6px;
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    border-radius: var(--astryx-radius-full, 9999px);
    overflow: hidden;
    pointer-events: none;
  }

  .astryx-slider-fill {
    height: 100%;
    background-color: var(--astryx-color-brand, #18181b);
    border-radius: var(--astryx-radius-full, 9999px);
    transition: width 50ms linear;
  }

  .astryx-slider-native {
    position: relative;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    opacity: 0;
    cursor: pointer;
    z-index: 2;
  }

  /* Custom thumb display over the track */
  .astryx-slider-track-wrap::after {
    content: '';
    position: absolute;
    left: calc(var(--percentage, 0%) - 8px);
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: var(--astryx-color-surface, #ffffff);
    border: 2px solid var(--astryx-color-brand, #18181b);
    box-shadow: var(--astryx-elevation-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
    pointer-events: none;
    transition: transform var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
  }

  /* When input is visible or native range thumb is used */
  .astryx-slider-native {
    opacity: 1;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    outline: none;
  }

  .astryx-slider-native:focus {
    outline: none;
  }

  .astryx-slider-native::-webkit-slider-runnable-track {
    height: 6px;
    background: transparent;
  }

  .astryx-slider-native::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: var(--astryx-color-surface, #ffffff);
    border: 2px solid var(--astryx-color-brand, #18181b);
    box-shadow: var(--astryx-elevation-sm, 0 1px 3px rgba(0, 0, 0, 0.15));
    cursor: pointer;
    margin-top: -5px;
    transition:
      transform 120ms ease,
      box-shadow 120ms ease;
  }

  .astryx-slider-native::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: var(--astryx-elevation-md, 0 4px 6px -1px rgba(0, 0, 0, 0.15));
  }

  .astryx-slider-native::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: var(--astryx-color-surface, #ffffff);
    border: 2px solid var(--astryx-color-brand, #18181b);
    box-shadow: var(--astryx-elevation-sm, 0 1px 3px rgba(0, 0, 0, 0.15));
    cursor: pointer;
  }

  .astryx-slider-native:focus-visible::-webkit-slider-thumb {
    box-shadow:
      0 0 0 2px var(--astryx-color-surface, #fff),
      0 0 0 4px var(--astryx-color-border-focus, #18181b);
  }

  /* Sizes */
  [data-size='sm'] .astryx-slider-track {
    height: 4px;
  }
  [data-size='sm'] .astryx-slider-native::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    margin-top: -4px;
  }

  [data-size='lg'] .astryx-slider-track {
    height: 8px;
  }
  [data-size='lg'] .astryx-slider-native::-webkit-slider-thumb {
    width: 20px;
    height: 20px;
    margin-top: -6px;
  }

  .is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
</style>
