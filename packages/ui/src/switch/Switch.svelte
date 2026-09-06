<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let checked: boolean = false;
  export let disabled: boolean = false;
  export let label: string = '';
  export let description: string = '';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{
    change: { checked: boolean };
  }>();

  function toggle() {
    if (!disabled) {
      checked = !checked;
      dispatch('change', { checked });
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      toggle();
    }
  }
</script>

<label class="astryx-switch-wrap {customClass}" class:is-disabled={disabled} data-size={size}>
  <input
    type="checkbox"
    class="astryx-switch-input"
    {checked}
    {disabled}
    aria-label={label || undefined}
    on:change={toggle}
  />
  <div
    role="switch"
    tabindex={disabled ? -1 : 0}
    aria-checked={checked}
    class="astryx-switch"
    class:is-checked={checked}
    on:keydown={handleKeyDown}
    {...$$restProps}
  >
    <div class="astryx-switch-thumb"></div>
  </div>

  {#if label || description}
    <div class="astryx-switch-text">
      {#if label}
        <span class="astryx-switch-label">{label}</span>
      {/if}
      {#if description}
        <span class="astryx-switch-description">{description}</span>
      {/if}
    </div>
  {/if}
</label>

<style>
  .astryx-switch-wrap {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--astryx-space-2-5, 10px);
    cursor: pointer;
    user-select: none;
    font-family: var(--astryx-font-family-sans, sans-serif);
    box-sizing: border-box;
  }

  .astryx-switch-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .astryx-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    border: 1px solid var(--astryx-color-border-default, #d4d4d8);
    border-radius: var(--astryx-radius-full, 9999px);
    cursor: pointer;
    transition:
      background-color var(--astryx-duration-normal, 200ms) var(--astryx-ease, ease),
      border-color var(--astryx-duration-normal, 200ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
    outline: none;
    flex-shrink: 0;
  }

  .astryx-switch:focus-visible,
  .astryx-switch-input:focus-visible + .astryx-switch {
    box-shadow:
      0 0 0 2px var(--astryx-color-surface, #fff),
      0 0 0 4px var(--astryx-color-border-focus, #18181b);
  }

  .astryx-switch.is-checked {
    background-color: var(--astryx-color-brand, #18181b);
    border-color: var(--astryx-color-brand, #18181b);
  }

  .astryx-switch-thumb {
    position: absolute;
    background-color: #ffffff;
    border-radius: 50%;
    box-shadow: var(--astryx-elevation-sm, 0 1px 2px rgba(0, 0, 0, 0.2));
    transition:
      transform var(--astryx-duration-normal, 200ms) var(--astryx-ease, ease),
      background-color var(--astryx-duration-normal, 200ms) var(--astryx-ease, ease);
  }

  .astryx-switch.is-checked .astryx-switch-thumb {
    background-color: var(--astryx-color-fg-on-brand, #18181b);
  }

  /* Sizes */
  [data-size='sm'] .astryx-switch {
    width: 32px;
    height: 18px;
  }
  [data-size='sm'] .astryx-switch-thumb {
    width: 14px;
    height: 14px;
    left: 1px;
  }
  [data-size='sm'] .astryx-switch.is-checked .astryx-switch-thumb {
    transform: translateX(14px);
  }

  [data-size='md'] .astryx-switch {
    width: 42px;
    height: 24px;
  }
  [data-size='md'] .astryx-switch-thumb {
    width: 18px;
    height: 18px;
    left: 2px;
  }
  [data-size='md'] .astryx-switch.is-checked .astryx-switch-thumb {
    transform: translateX(18px);
  }

  [data-size='lg'] .astryx-switch {
    width: 52px;
    height: 30px;
  }
  [data-size='lg'] .astryx-switch-thumb {
    width: 24px;
    height: 24px;
    left: 2px;
  }
  [data-size='lg'] .astryx-switch.is-checked .astryx-switch-thumb {
    transform: translateX(22px);
  }

  .astryx-switch-text {
    display: flex;
    flex-direction: column;
    gap: var(--astryx-space-0-5, 2px);
  }

  .astryx-switch-label {
    font-size: var(--astryx-font-size-sm, 0.875rem);
    font-weight: var(--astryx-font-weight-medium, 500);
    color: var(--astryx-color-fg-primary, #18181b);
    line-height: 1.3;
  }

  .astryx-switch-description {
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-fg-secondary, #71717a);
    line-height: 1.3;
  }

  .is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .is-disabled .astryx-switch {
    cursor: not-allowed;
  }
</style>
