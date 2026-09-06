<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SelectOption, SelectSize, SelectVariant } from '../types';

  export let options: (string | SelectOption)[] = [];
  export let value: string | number = '';
  export let placeholder: string = '';
  export let label: string = '';
  export let helperText: string = '';
  export let error: string | boolean = false;
  export let size: SelectSize = 'md';
  export let variant: SelectVariant = 'outline';
  export let disabled: boolean = false;
  export let id: string = `astryx-select-${Math.random().toString(36).substring(2, 9)}`;
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{
    change: { value: string | number };
    focus: FocusEvent;
    blur: FocusEvent;
  }>();

  let isFocused = false;

  $: hasError = !!error;
  $: errorMessage = typeof error === 'string' ? error : '';

  $: normalizedOptions = options.map((opt) =>
    typeof opt === 'string'
      ? { value: opt, label: opt, disabled: false }
      : { value: opt.value, label: opt.label, disabled: !!opt.disabled }
  );

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    value = target.value;
    dispatch('change', { value });
  }

  function handleFocus(e: FocusEvent) {
    isFocused = true;
    dispatch('focus', e);
  }

  function handleBlur(e: FocusEvent) {
    isFocused = false;
    dispatch('blur', e);
  }
</script>

<div
  class="astryx-select-wrapper {customClass}"
  class:is-disabled={disabled}
  class:has-error={hasError}
  class:is-focused={isFocused}
  data-size={size}
  data-variant={variant}
>
  {#if label}
    <label for={id} class="astryx-select-label">
      {label}
    </label>
  {/if}

  <div class="astryx-select-box">
    {#if $$slots.prefix}
      <div class="astryx-select-prefix" aria-hidden="true">
        <slot name="prefix" />
      </div>
    {/if}

    <select
      {id}
      {disabled}
      {value}
      class="astryx-select-element"
      on:change={handleChange}
      on:focus={handleFocus}
      on:blur={handleBlur}
      {...$$restProps}
    >
      {#if placeholder}
        <option value="" disabled selected={value === '' || value === undefined}>
          {placeholder}
        </option>
      {/if}

      {#each normalizedOptions as opt (opt.value)}
        <option value={opt.value} disabled={opt.disabled} selected={opt.value === value}>
          {opt.label}
        </option>
      {/each}
    </select>

    <div class="astryx-select-arrow" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  </div>

  {#if hasError && errorMessage}
    <p class="astryx-select-feedback is-error" role="alert">{errorMessage}</p>
  {:else if helperText}
    <p class="astryx-select-feedback">{helperText}</p>
  {/if}
</div>

<style>
  .astryx-select-wrapper {
    display: inline-flex;
    flex-direction: column;
    width: 100%;
    font-family: var(--astryx-font-family-sans, sans-serif);
    box-sizing: border-box;
    text-align: left;
  }

  .astryx-select-label {
    display: block;
    margin-bottom: var(--astryx-space-1-5, 6px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
    font-weight: var(--astryx-font-weight-medium, 500);
    color: var(--astryx-color-fg-primary, #18181b);
    user-select: none;
    line-height: 1.2;
  }

  .astryx-select-box {
    display: flex;
    align-items: center;
    position: relative;
    width: 100%;
    box-sizing: border-box;
    background-color: var(--astryx-color-surface, #ffffff);
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    border-radius: var(--astryx-radius-md, 6px);
    transition:
      border-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      background-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
  }

  /* Sizes */
  [data-size='sm'] .astryx-select-box {
    height: 30px;
    padding-left: var(--astryx-space-2, 8px);
    padding-right: var(--astryx-space-6, 24px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
  }
  [data-size='sm'] .astryx-select-element {
    font-size: var(--astryx-font-size-xs, 0.75rem);
  }

  [data-size='md'] .astryx-select-box {
    height: 38px;
    padding-left: var(--astryx-space-3, 12px);
    padding-right: var(--astryx-space-7, 28px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }
  [data-size='md'] .astryx-select-element {
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }

  [data-size='lg'] .astryx-select-box {
    height: 46px;
    padding-left: var(--astryx-space-4, 16px);
    padding-right: var(--astryx-space-8, 32px);
    font-size: var(--astryx-font-size-md, 1rem);
  }
  [data-size='lg'] .astryx-select-element {
    font-size: var(--astryx-font-size-md, 1rem);
  }

  /* Select native element */
  .astryx-select-element {
    flex: 1;
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0;
    margin: 0;
    border: none;
    outline: none;
    background: transparent;
    box-shadow: none;
    color: var(--astryx-color-fg-primary, #18181b);
    font-family: inherit;
    line-height: inherit;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }

  .astryx-select-element:focus,
  .astryx-select-element:focus-visible,
  .astryx-select-element:active {
    outline: none !important;
    border: none !important;
    border-color: transparent !important;
    box-shadow: none !important;
    --tw-ring-color: transparent !important;
    --tw-ring-shadow: none !important;
    --tw-ring-offset-shadow: none !important;
  }

  /* Option dropdown background */
  .astryx-select-element option {
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-primary, #18181b);
  }

  /* Arrow icon */
  .astryx-select-arrow {
    position: absolute;
    right: var(--astryx-space-2-5, 10px);
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--astryx-color-fg-muted, #71717a);
    transition: transform var(--astryx-duration-fast, 120ms) ease;
  }

  /* Hover & Focus state */
  .astryx-select-box:hover {
    border-color: var(--astryx-color-border-hover, #d4d4d8);
  }

  .astryx-select-wrapper.is-focused .astryx-select-box {
    border-color: var(--astryx-color-border-focus, #18181b);
    box-shadow:
      0 0 0 1px var(--astryx-color-border-focus, #18181b),
      0 0 0 3px rgba(24, 24, 27, 0.08);
  }

  /* Variants */
  [data-variant='filled'] .astryx-select-box {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: transparent;
  }
  [data-variant='filled'] .astryx-select-box:hover {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    border-color: transparent;
  }
  [data-variant='filled'].is-focused .astryx-select-box {
    background-color: var(--astryx-color-surface, #ffffff);
    border-color: var(--astryx-color-border-focus, #18181b);
  }

  [data-variant='underline'] .astryx-select-box {
    background-color: transparent;
    border: none;
    border-bottom: 2px solid var(--astryx-color-border-default, #e4e4e7);
    border-radius: 0;
    padding-left: 0;
  }
  [data-variant='underline'] .astryx-select-box:hover {
    border-bottom-color: var(--astryx-color-border-hover, #d4d4d8);
  }
  [data-variant='underline'].is-focused .astryx-select-box {
    border-bottom-color: var(--astryx-color-border-focus, #18181b);
    box-shadow: none;
  }

  /* Prefix */
  .astryx-select-prefix {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: var(--astryx-space-2, 8px);
    color: var(--astryx-color-fg-muted, #71717a);
  }

  /* Disabled state */
  .is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .is-disabled .astryx-select-element {
    cursor: not-allowed;
  }
  .is-disabled .astryx-select-box {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
  }

  /* Error state */
  .has-error .astryx-select-box {
    border-color: var(--astryx-color-danger, #ef4444) !important;
  }
  .has-error.is-focused .astryx-select-box {
    box-shadow:
      0 0 0 1px var(--astryx-color-danger, #ef4444),
      0 0 0 3px rgba(239, 68, 68, 0.15);
  }

  /* Helper text & error feedback */
  .astryx-select-feedback {
    margin: var(--astryx-space-1, 4px) 0 0 0;
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-fg-secondary, #71717a);
    line-height: 1.3;
  }
  .astryx-select-feedback.is-error {
    color: var(--astryx-color-danger, #ef4444);
  }
</style>
