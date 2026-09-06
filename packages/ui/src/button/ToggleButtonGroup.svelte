<script context="module" lang="ts">
  export interface ToggleGroupOption<T = any> {
    id: T;
    text: string;
    style?: Record<string, string>;
    thickBorders?: boolean;
    showIcons?: boolean;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let options: ToggleGroupOption<any>[] = [];
  export let selectedOptionId: any = undefined;
  export let value: any = undefined;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let invertColors: boolean = false;
  let customClass: string = '';
  export { customClass as class };

  // Allow binding to either `value` or `selectedOptionId`
  $: currentSelected = value !== undefined ? value : selectedOptionId;

  const dispatch = createEventDispatcher<{
    change: { value: any; id: any };
    edit: string | any;
    delete: string | any;
  }>();

  function selectOption(id: any) {
    selectedOptionId = id;
    value = id;
    dispatch('change', { value: id, id });
  }

  function mapToStyleString(style: Record<string, any> | undefined) {
    if (!style) return '';
    return Object.entries(style)
      .map(([k, v]) => `${k}: ${v}`)
      .join(';');
  }
</script>

<div
  role="radiogroup"
  class="astryx-toggle-button-group {customClass}"
  data-size={size}
  {...$$restProps}
>
  {#each options as option (option.id)}
    {@const isSelected = option.id === currentSelected}
    <div class="astryx-toggle-group-item-wrap">
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        title={String(option.id)}
        disabled={option.disabled}
        class="astryx-toggle-group-btn"
        class:is-selected={isSelected}
        class:is-thick-border={option.thickBorders && isSelected}
        class:invert-colors={invertColors}
        style={mapToStyleString(option.style)}
        on:click={() => selectOption(option.id)}
      >
        <span class="astryx-toggle-text">{option.text}</span>
      </button>

      {#if option.showIcons && isSelected}
        <div class="astryx-toggle-actions">
          <button
            type="button"
            class="astryx-action-mini-btn"
            aria-label="Edit option"
            title="Edit"
            on:click|stopPropagation={() => dispatch('edit', option.id)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path
                d="m15 5 4 4"
              /></svg
            >
          </button>
          <button
            type="button"
            class="astryx-action-mini-btn is-delete"
            aria-label="Delete option"
            title="Delete"
            on:click|stopPropagation={() => dispatch('delete', option.id)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
                d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
              /></svg
            >
          </button>
        </div>
      {/if}
    </div>
  {/each}

  <slot />
</div>

<style>
  .astryx-toggle-button-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--astryx-space-2, 8px);
    box-sizing: border-box;
    font-family: var(--astryx-font-family-sans, sans-serif);
  }

  .astryx-toggle-group-item-wrap {
    display: inline-flex;
    align-items: center;
    position: relative;
  }

  .astryx-toggle-group-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    font-family: inherit;
    font-weight: var(--astryx-font-weight-medium, 500);
    border-radius: var(--astryx-radius-md, 6px);
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-primary, #18181b);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition:
      background-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      border-color var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      box-shadow var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease),
      transform var(--astryx-duration-fast, 120ms) var(--astryx-ease, ease);
    outline: none;
  }

  /* Sizes */
  [data-size='sm'] .astryx-toggle-group-btn {
    height: 30px;
    padding: 0 var(--astryx-space-2-5, 10px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
  }

  [data-size='md'] .astryx-toggle-group-btn {
    height: 38px;
    padding: 0 var(--astryx-space-3-5, 14px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }

  [data-size='lg'] .astryx-toggle-group-btn {
    height: 46px;
    padding: 0 var(--astryx-space-5, 20px);
    font-size: var(--astryx-font-size-md, 1rem);
  }

  .astryx-toggle-group-btn:hover:not(:disabled):not(.is-selected) {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border-color: var(--astryx-color-border-hover, #d4d4d8);
  }

  .astryx-toggle-group-btn:focus-visible {
    box-shadow:
      0 0 0 2px var(--astryx-color-surface, #fff),
      0 0 0 4px var(--astryx-color-border-focus, #18181b);
  }

  /* Selected state */
  .astryx-toggle-group-btn.is-selected {
    background-color: var(--astryx-color-brand, #18181b);
    color: var(--astryx-color-fg-on-brand, #ffffff);
    border-color: var(--astryx-color-brand, #18181b);
    font-weight: var(--astryx-font-weight-semibold, 600);
    box-shadow: var(--astryx-elevation-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
  }

  .astryx-toggle-group-btn.is-thick-border {
    border-width: 2px;
    border-color: var(--astryx-color-accent, #0284c7);
  }

  .astryx-toggle-group-btn.invert-colors.is-selected {
    background-color: #ffffff;
    color: #18181b;
  }
  .astryx-toggle-group-btn.invert-colors:not(.is-selected) {
    background-color: #27272a;
    color: #ffffff;
  }

  .astryx-toggle-group-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Mini action buttons for custom theme edit/delete */
  .astryx-toggle-actions {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    margin-left: var(--astryx-space-1, 4px);
  }

  .astryx-action-mini-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: var(--astryx-color-surface-subtle, #f4f4f5);
    border: 1px solid var(--astryx-color-border-subtle, #e4e4e7);
    border-radius: var(--astryx-radius-sm, 4px);
    color: var(--astryx-color-fg-secondary, #52525b);
    cursor: pointer;
    transition:
      background-color 100ms ease,
      color 100ms ease;
  }

  .astryx-action-mini-btn:hover {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    color: var(--astryx-color-fg-primary, #18181b);
  }

  .astryx-action-mini-btn.is-delete:hover {
    background-color: var(--astryx-color-danger-subtle, #fee2e2);
    color: var(--astryx-color-danger, #ef4444);
    border-color: var(--astryx-color-danger, #ef4444);
  }
</style>
