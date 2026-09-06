<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TabItem, TabSize, TabVariant } from '../types';

  export let items: (string | TabItem)[] = [];
  export let activeId: string = '';
  export let variant: TabVariant = 'pill';
  export let size: TabSize = 'md';
  export let fullWidth: boolean = false;
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{
    change: { id: string };
  }>();

  $: normalizedItems = items.map((item) =>
    typeof item === 'string'
      ? { id: item, label: item, disabled: false }
      : { ...item, disabled: !!item.disabled }
  );

  $: if (!activeId && normalizedItems.length > 0) {
    activeId = normalizedItems[0].id;
  }

  function selectTab(id: string, disabled?: boolean) {
    if (disabled || activeId === id) return;
    activeId = id;
    dispatch('change', { id });
  }

  function handleKeyDown(e: KeyboardEvent, index: number) {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % normalizedItems.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + normalizedItems.length) % normalizedItems.length;
    }

    if (nextIndex >= 0) {
      e.preventDefault();
      const target = normalizedItems[nextIndex];
      if (!target.disabled) {
        selectTab(target.id);
      }
    }
  }
</script>

<div
  role="tablist"
  class="astryx-tabs-container {customClass}"
  class:full-width={fullWidth}
  data-variant={variant}
  data-size={size}
  {...$$restProps}
>
  {#each normalizedItems as item, idx (item.id)}
    {@const isSelected = activeId === item.id}
    <button
      type="button"
      role="tab"
      id={`tab-${item.id}`}
      aria-selected={isSelected}
      aria-controls={`tabpanel-${item.id}`}
      tabindex={isSelected ? 0 : -1}
      disabled={item.disabled}
      class="astryx-tab-btn"
      class:is-active={isSelected}
      on:click={() => selectTab(item.id, item.disabled)}
      on:keydown={(e) => handleKeyDown(e, idx)}
    >
      {#if item.icon}
        <span class="astryx-tab-icon" aria-hidden="true">
          {#if typeof item.icon === 'string'}
            {@html item.icon}
          {:else}
            <svelte:component this={item.icon} />
          {/if}
        </span>
      {:else}
        <slot name="icon" {item} />
      {/if}

      <span class="astryx-tab-label">{item.label}</span>

      {#if item.badge !== undefined && item.badge !== null}
        <span class="astryx-tab-badge" class:is-active={isSelected}>{item.badge}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .astryx-tabs-container {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    font-family: var(--astryx-font-family-sans, sans-serif);
    user-select: none;
    position: relative;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .astryx-tabs-container::-webkit-scrollbar {
    display: none;
  }

  .full-width {
    display: flex;
    width: 100%;
  }

  /* Variant: Pill */
  [data-variant='pill'] {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border: 1px solid var(--astryx-color-border-subtle, #e4e4e7);
    border-radius: var(--astryx-radius-lg, 10px);
    padding: var(--astryx-space-1, 4px);
    gap: var(--astryx-space-1, 4px);
  }

  [data-variant='pill'] .astryx-tab-btn {
    border-radius: calc(var(--astryx-radius-lg, 10px) - 3px);
    color: var(--astryx-color-fg-secondary, #52525b);
    background: transparent;
  }

  [data-variant='pill'] .astryx-tab-btn:hover:not(:disabled):not(.is-active) {
    color: var(--astryx-color-fg-primary, #18181b);
    background-color: var(--astryx-color-surface-active, #e4e4e7);
  }

  [data-variant='pill'] .astryx-tab-btn.is-active {
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-primary, #18181b);
    font-weight: var(--astryx-font-weight-semibold, 600);
    box-shadow: var(--astryx-elevation-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  }

  /* Variant: Underline */
  [data-variant='underline'] {
    border-bottom: 1px solid var(--astryx-color-border-default, #e4e4e7);
    gap: var(--astryx-space-6, 24px);
    padding: 0 var(--astryx-space-2, 8px);
  }

  [data-variant='underline'] .astryx-tab-btn {
    position: relative;
    border-radius: 0;
    color: var(--astryx-color-fg-secondary, #71717a);
    background: transparent;
  }

  [data-variant='underline'] .astryx-tab-btn:hover:not(:disabled):not(.is-active) {
    color: var(--astryx-color-fg-primary, #18181b);
  }

  [data-variant='underline'] .astryx-tab-btn.is-active {
    color: var(--astryx-color-brand, #18181b);
    font-weight: var(--astryx-font-weight-semibold, 600);
  }

  [data-variant='underline'] .astryx-tab-btn.is-active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--astryx-color-brand, #18181b);
    border-radius: var(--astryx-radius-full, 9999px);
  }

  /* Variant: Bar */
  [data-variant='bar'] {
    background-color: var(--astryx-color-surface, #ffffff);
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    border-radius: var(--astryx-radius-md, 6px);
    gap: 0;
  }

  [data-variant='bar'] .astryx-tab-btn {
    border-radius: 0;
    color: var(--astryx-color-fg-secondary, #71717a);
    background: transparent;
    border-right: 1px solid var(--astryx-color-border-subtle, #f4f4f5);
  }
  [data-variant='bar'] .astryx-tab-btn:last-child {
    border-right: none;
  }
  [data-variant='bar'] .astryx-tab-btn.is-active {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    color: var(--astryx-color-fg-primary, #18181b);
    font-weight: var(--astryx-font-weight-semibold, 600);
  }

  /* Base button */
  .astryx-tab-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-weight: var(--astryx-font-weight-medium, 500);
    white-space: nowrap;
    text-decoration: none;
    transition:
      color var(--astryx-duration-fast, 120ms) ease,
      background-color var(--astryx-duration-fast, 120ms) ease,
      box-shadow var(--astryx-duration-fast, 120ms) ease;
    outline: none;
    box-sizing: border-box;
  }

  .astryx-tab-btn:focus-visible {
    outline: 2px solid var(--astryx-color-border-focus, #18181b);
    outline-offset: -2px;
  }

  .astryx-tab-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Sizes */
  [data-size='sm'] .astryx-tab-btn {
    height: 30px;
    padding: 0 var(--astryx-space-3, 12px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
    gap: var(--astryx-space-1-5, 6px);
  }

  [data-size='md'] .astryx-tab-btn {
    height: 38px;
    padding: 0 var(--astryx-space-4, 16px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
    gap: var(--astryx-space-2, 8px);
  }

  [data-size='lg'] .astryx-tab-btn {
    height: 46px;
    padding: 0 var(--astryx-space-5, 20px);
    font-size: var(--astryx-font-size-md, 1rem);
    gap: var(--astryx-space-2-5, 10px);
  }

  /* Icon & Badge */
  .astryx-tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .astryx-tab-label {
    line-height: 1;
  }

  .astryx-tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 0.6875rem;
    font-weight: var(--astryx-font-weight-semibold, 600);
    border-radius: var(--astryx-radius-full, 9999px);
    background-color: var(--astryx-color-surface-active, #e4e4e7);
    color: var(--astryx-color-fg-secondary, #52525b);
  }

  .astryx-tab-badge.is-active {
    background-color: var(--astryx-color-brand, #18181b);
    color: #ffffff;
  }
</style>
