<script lang="ts">
  import { getContext, createEventDispatcher } from 'svelte';
  import type { Writable } from 'svelte/store';

  export let headline: string = '';
  export let title: string = '';
  export let description: string = '';
  export let subtitle: string = '';
  export let clickable: boolean = false;
  export let selected: boolean = false;
  export let disabled: boolean = false;
  export let href: string = '';
  export let density: 'compact' | 'normal' | 'relaxed' | undefined = undefined;
  let customClass: string = '';
  export { customClass as class };

  const listContext =
    getContext<Writable<{ density: 'compact' | 'normal' | 'relaxed'; divided: boolean }>>(
      'astryx-list'
    );

  $: effectiveDensity = density || ($listContext?.density ?? 'normal');
  $: primaryText = headline || title;
  $: secondaryText = description || subtitle;
  $: isInteractive = clickable || !!href;

  const dispatch = createEventDispatcher<{
    click: MouseEvent;
    keydown: KeyboardEvent;
  }>();

  function handleClick(e: MouseEvent) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    dispatch('click', e);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      dispatch('click', e as any);
    }
    dispatch('keydown', e);
  }
</script>

<li
  class="astryx-list-item {customClass}"
  class:is-interactive={isInteractive}
  class:is-selected={selected}
  class:is-disabled={disabled}
  data-density={effectiveDensity}
  {...$$restProps}
>
  {#if href}
    <a
      {href}
      class="astryx-list-item-inner"
      aria-disabled={disabled}
      tabindex={disabled ? -1 : 0}
      on:click={handleClick}
      on:keydown={handleKeyDown}
    >
      {#if $$slots.prefix}
        <div class="astryx-list-item-prefix" aria-hidden="true">
          <slot name="prefix" />
        </div>
      {/if}

      <div class="astryx-list-item-content">
        {#if primaryText}
          <div class="astryx-list-item-headline">{primaryText}</div>
        {/if}
        {#if secondaryText}
          <div class="astryx-list-item-description">{secondaryText}</div>
        {/if}
        <slot />
      </div>

      {#if $$slots.suffix}
        <div class="astryx-list-item-suffix">
          <slot name="suffix" />
        </div>
      {/if}
    </a>
  {:else if clickable}
    <button
      type="button"
      class="astryx-list-item-inner is-button"
      {disabled}
      aria-pressed={selected}
      on:click={handleClick}
      on:keydown={handleKeyDown}
    >
      {#if $$slots.prefix}
        <div class="astryx-list-item-prefix" aria-hidden="true">
          <slot name="prefix" />
        </div>
      {/if}

      <div class="astryx-list-item-content">
        {#if primaryText}
          <div class="astryx-list-item-headline">{primaryText}</div>
        {/if}
        {#if secondaryText}
          <div class="astryx-list-item-description">{secondaryText}</div>
        {/if}
        <slot />
      </div>

      {#if $$slots.suffix}
        <div class="astryx-list-item-suffix">
          <slot name="suffix" />
        </div>
      {/if}
    </button>
  {:else}
    <div class="astryx-list-item-inner">
      {#if $$slots.prefix}
        <div class="astryx-list-item-prefix" aria-hidden="true">
          <slot name="prefix" />
        </div>
      {/if}

      <div class="astryx-list-item-content">
        {#if primaryText}
          <div class="astryx-list-item-headline">{primaryText}</div>
        {/if}
        {#if secondaryText}
          <div class="astryx-list-item-description">{secondaryText}</div>
        {/if}
        <slot />
      </div>

      {#if $$slots.suffix}
        <div class="astryx-list-item-suffix">
          <slot name="suffix" />
        </div>
      {/if}
    </div>
  {/if}
</li>

<style>
  .astryx-list-item {
    display: block;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    width: 100%;
    position: relative;
    background-color: transparent;
    transition: background-color var(--astryx-duration-fast, 120ms) ease;
  }

  .astryx-list-item-inner {
    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    text-decoration: none;
    color: inherit;
    background: transparent;
    border: none;
    font-family: inherit;
    cursor: default;
    transition: background-color var(--astryx-duration-fast, 120ms) ease;
  }

  .astryx-list-item-inner.is-button {
    cursor: pointer;
    user-select: none;
  }

  /* Densities */
  [data-density='compact'] .astryx-list-item-inner {
    padding: var(--astryx-space-1-5, 6px) var(--astryx-space-3, 12px);
    gap: var(--astryx-space-2-5, 10px);
  }
  [data-density='compact'] .astryx-list-item-headline {
    font-size: var(--astryx-font-size-xs, 0.75rem);
  }
  [data-density='compact'] .astryx-list-item-description {
    font-size: 0.6875rem;
  }

  [data-density='normal'] .astryx-list-item-inner {
    padding: var(--astryx-space-2-5, 10px) var(--astryx-space-4, 16px);
    gap: var(--astryx-space-3, 12px);
  }
  [data-density='normal'] .astryx-list-item-headline {
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }
  [data-density='normal'] .astryx-list-item-description {
    font-size: var(--astryx-font-size-xs, 0.75rem);
  }

  [data-density='relaxed'] .astryx-list-item-inner {
    padding: var(--astryx-space-3-5, 14px) var(--astryx-space-5, 20px);
    gap: var(--astryx-space-4, 16px);
  }
  [data-density='relaxed'] .astryx-list-item-headline {
    font-size: var(--astryx-font-size-md, 1rem);
  }
  [data-density='relaxed'] .astryx-list-item-description {
    font-size: var(--astryx-font-size-sm, 0.875rem);
  }

  /* Content area */
  .astryx-list-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .astryx-list-item-headline {
    font-weight: var(--astryx-font-weight-medium, 500);
    color: var(--astryx-color-fg-primary, #18181b);
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .astryx-list-item-description {
    color: var(--astryx-color-fg-secondary, #71717a);
    line-height: 1.4;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Prefix & Suffix slots */
  .astryx-list-item-prefix {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--astryx-color-fg-secondary, #52525b);
  }

  .astryx-list-item-suffix {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-left: auto;
    color: var(--astryx-color-fg-muted, #71717a);
  }

  /* Interactive hover and active feedback */
  .is-interactive:not(.is-disabled) .astryx-list-item-inner:hover {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
  }

  .is-interactive:not(.is-disabled) .astryx-list-item-inner:active {
    background-color: var(--astryx-color-surface-active, #e4e4e7);
  }

  .is-interactive:not(.is-disabled) .astryx-list-item-inner:focus-visible {
    outline: 2px solid var(--astryx-color-border-focus, #18181b);
    outline-offset: -2px;
  }

  /* Selected state */
  .is-selected .astryx-list-item-inner {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
  }
  .is-selected::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background-color: var(--astryx-color-brand, #18181b);
    border-top-left-radius: var(--astryx-radius-xs, 2px);
    border-bottom-left-radius: var(--astryx-radius-xs, 2px);
  }

  /* Disabled state */
  .is-disabled {
    opacity: 0.45;
    pointer-events: none;
  }
</style>
