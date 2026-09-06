<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: string | number | null | undefined = '';
  export let type: string = 'text';
  export let label: string = '';
  export let placeholder: string = '';
  export let helperText: string = '';
  export let error: string | boolean = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let variant: 'outline' | 'filled' | 'underline' = 'outline';
  export let disabled: boolean = false;
  export let readonly: boolean = false;
  export let clearable: boolean = false;
  export let id: string = `astryx-input-${Math.random().toString(36).substring(2, 9)}`;
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{
    input: Event;
    change: Event;
    focus: FocusEvent;
    blur: FocusEvent;
    keydown: KeyboardEvent;
    clear: void;
  }>();

  let isFocused = false;
  let inputEl: HTMLInputElement;

  $: hasError = !!error;
  $: errorMessage = typeof error === 'string' ? error : '';
  $: showClear =
    clearable && !disabled && !readonly && value !== '' && value !== undefined && value !== null;

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = type === 'number' ? (target.value === '' ? '' : Number(target.value)) : target.value;
    dispatch('input', e);
  }

  function handleChange(e: Event) {
    dispatch('change', e);
  }

  function handleFocus(e: FocusEvent) {
    isFocused = true;
    dispatch('focus', e);
  }

  function handleBlur(e: FocusEvent) {
    isFocused = false;
    dispatch('blur', e);
  }

  function handleKeyDown(e: KeyboardEvent) {
    dispatch('keydown', e);
  }

  function handleClear() {
    value = '';
    dispatch('clear');
    if (inputEl) {
      inputEl.focus();
    }
  }
</script>

<div
  class="astryx-input-wrapper {customClass}"
  class:is-disabled={disabled}
  class:has-error={hasError}
  class:is-focused={isFocused}
  data-size={size}
  data-variant={variant}
>
  {#if label}
    <label for={id} class="astryx-input-label">
      {label}
    </label>
  {/if}

  <div class="astryx-input-box">
    {#if $$slots.prefix}
      <div class="astryx-input-prefix" aria-hidden="true">
        <slot name="prefix" />
      </div>
    {/if}

    <input
      {id}
      bind:this={inputEl}
      {type}
      {placeholder}
      {disabled}
      {readonly}
      {value}
      class="astryx-input-element"
      on:input={handleInput}
      on:change={handleChange}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeyDown}
      {...$$restProps}
    />

    {#if showClear}
      <button
        type="button"
        class="astryx-input-clear-btn"
        aria-label="Clear input"
        tabindex="-1"
        on:click|stopPropagation={handleClear}
      >
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
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </button>
    {/if}

    {#if $$slots.suffix}
      <div class="astryx-input-suffix" aria-hidden="true">
        <slot name="suffix" />
      </div>
    {/if}
  </div>

  {#if hasError && errorMessage}
    <p class="astryx-input-feedback is-error" role="alert">{errorMessage}</p>
  {:else if helperText}
    <p class="astryx-input-feedback is-helper">{helperText}</p>
  {/if}
</div>

<style>
  .astryx-input-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    font-family: var(--astryx-font-family-sans, sans-serif);
    box-sizing: border-box;
    text-align: left;
  }

  .astryx-input-label {
    display: block;
    margin-bottom: var(--astryx-space-1-5, 6px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
    font-weight: var(--astryx-font-weight-medium, 500);
    color: var(--astryx-color-fg-primary, #18181b);
    user-select: none;
    line-height: 1.2;
  }

  .astryx-input-box {
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
  [data-size='sm'] .astryx-input-box {
    height: 30px;
    padding: 0 var(--astryx-space-2, 8px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
  }
  [data-size='sm'] .astryx-input-element {
    font-size: var(--astryx-font-size-xs, 0.75rem);
  }

  [data-size='md'] .astryx-input-box {
    height: 38px;
    padding: 0 var(--astryx-space-3, 12px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }
  [data-size='md'] .astryx-input-element {
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }

  [data-size='lg'] .astryx-input-box {
    height: 46px;
    padding: 0 var(--astryx-space-4, 16px);
    font-size: var(--astryx-font-size-md, 1rem);
  }
  [data-size='lg'] .astryx-input-element {
    font-size: var(--astryx-font-size-md, 1rem);
  }

  /* Input native element */
  .astryx-input-element {
    flex: 1;
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0;
    margin: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--astryx-color-fg-primary, #18181b);
    font-family: inherit;
    line-height: inherit;
  }

  .astryx-input-element::placeholder {
    color: var(--astryx-color-fg-muted, #a1a1aa);
    opacity: 1;
  }

  /* Hover & Focus state */
  .astryx-input-box:hover {
    border-color: var(--astryx-color-border-hover, #d4d4d8);
  }

  .astryx-input-wrapper.is-focused .astryx-input-box {
    border-color: var(--astryx-color-border-focus, #18181b);
    box-shadow:
      0 0 0 1px var(--astryx-color-border-focus, #18181b),
      0 0 0 3px rgba(24, 24, 27, 0.08);
  }

  /* Variants */
  [data-variant='filled'] .astryx-input-box {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: transparent;
  }
  [data-variant='filled'] .astryx-input-box:hover {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    border-color: transparent;
  }
  [data-variant='filled'].is-focused .astryx-input-box {
    background-color: var(--astryx-color-surface, #ffffff);
    border-color: var(--astryx-color-border-focus, #18181b);
  }

  [data-variant='underline'] .astryx-input-box {
    background-color: transparent;
    border-top: none;
    border-left: none;
    border-right: none;
    border-bottom: 2px solid var(--astryx-color-border-default, #e4e4e7);
    border-radius: 0;
    padding-left: 0;
    padding-right: 0;
  }
  [data-variant='underline'] .astryx-input-box:hover {
    border-bottom-color: var(--astryx-color-border-hover, #d4d4d8);
  }
  [data-variant='underline'].is-focused .astryx-input-box {
    border-bottom-color: var(--astryx-color-border-focus, #18181b);
    box-shadow: none;
  }

  /* Error state */
  .astryx-input-wrapper.has-error .astryx-input-box {
    border-color: var(--astryx-color-danger, #ef4444);
  }
  .astryx-input-wrapper.has-error.is-focused .astryx-input-box {
    box-shadow:
      0 0 0 1px var(--astryx-color-danger, #ef4444),
      0 0 0 3px rgba(239, 68, 68, 0.12);
  }
  .astryx-input-wrapper.has-error .astryx-input-label {
    color: var(--astryx-color-danger, #ef4444);
  }

  /* Disabled state */
  .astryx-input-wrapper.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .astryx-input-wrapper.is-disabled .astryx-input-box {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: var(--astryx-color-border-subtle, #e4e4e7);
    pointer-events: none;
  }

  /* Prefix & Suffix icons */
  .astryx-input-prefix {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: var(--astryx-space-2, 8px);
    color: var(--astryx-color-fg-muted, #71717a);
    flex-shrink: 0;
  }

  .astryx-input-suffix {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--astryx-space-2, 8px);
    color: var(--astryx-color-fg-muted, #71717a);
    flex-shrink: 0;
  }

  /* Clear button */
  .astryx-input-clear-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--astryx-space-1, 4px);
    padding: 2px;
    border: none;
    background: transparent;
    color: var(--astryx-color-fg-muted, #a1a1aa);
    cursor: pointer;
    border-radius: var(--astryx-radius-full, 9999px);
    transition: color 100ms ease;
  }
  .astryx-input-clear-btn:hover {
    color: var(--astryx-color-fg-primary, #18181b);
  }

  /* Feedback messages */
  .astryx-input-feedback {
    margin: var(--astryx-space-1, 4px) 0 0 0;
    font-size: var(--astryx-font-size-xs, 0.75rem);
    line-height: 1.3;
  }
  .astryx-input-feedback.is-error {
    color: var(--astryx-color-danger, #ef4444);
  }
  .astryx-input-feedback.is-helper {
    color: var(--astryx-color-fg-muted, #71717a);
  }
</style>
