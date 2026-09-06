<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open: boolean = false;
  export let title: string = '';
  export let description: string = '';
  export let size: 'sm' | 'md' | 'lg' | 'full' = 'md';
  export let showCloseButton: boolean = true;
  export let closeOnBackdropClick: boolean = true;
  export let closeOnEscape: boolean = true;
  let customClass: string = '';
  export { customClass as class };

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function handleClose() {
    open = false;
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (closeOnEscape && event.key === 'Escape' && open) {
      event.stopPropagation();
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if open}
  <div class="astryx-dialog-backdrop" role="presentation" on:click={handleBackdropClick}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'astryx-dialog-title' : undefined}
      aria-describedby={description ? 'astryx-dialog-desc' : undefined}
      class="astryx-dialog-surface {customClass}"
      data-size={size}
      {...$$restProps}
    >
      {#if title || $$slots.header || showCloseButton}
        <div class="astryx-dialog-header">
          <div class="astryx-dialog-titles">
            {#if title}
              <h2 id="astryx-dialog-title" class="astryx-dialog-title">{title}</h2>
            {/if}
            {#if description}
              <p id="astryx-dialog-desc" class="astryx-dialog-description">{description}</p>
            {/if}
            <slot name="header" />
          </div>
          {#if showCloseButton}
            <button
              type="button"
              class="astryx-dialog-close-btn"
              aria-label="Close dialog"
              title="Close dialog"
              on:click={handleClose}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          {/if}
        </div>
      {/if}

      <div class="astryx-dialog-body">
        <slot />
      </div>

      {#if $$slots.footer}
        <div class="astryx-dialog-footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .astryx-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--astryx-space-4, 16px);
    background-color: var(--astryx-color-overlay, rgba(0, 0, 0, 0.5));
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: astryx-fade-in 150ms var(--astryx-ease, ease) forwards;
  }

  .astryx-dialog-surface {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
    background-color: var(--astryx-color-surface, #ffffff);
    color: var(--astryx-color-fg-primary, #18181b);
    border: 1px solid var(--astryx-color-border-default, #e4e4e7);
    border-radius: var(--astryx-radius-lg, 10px);
    box-shadow: var(--astryx-elevation-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.12));
    overflow: hidden;
    animation: astryx-dialog-scale-in 180ms var(--astryx-ease, ease) forwards;
  }

  /* Sizes */
  [data-size='sm'] {
    max-width: 380px;
  }
  [data-size='md'] {
    max-width: 520px;
  }
  [data-size='lg'] {
    max-width: 720px;
  }
  [data-size='full'] {
    max-width: calc(100vw - 32px);
    height: calc(100vh - 32px);
  }

  .astryx-dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--astryx-space-4, 16px) var(--astryx-space-5, 20px);
    border-bottom: 1px solid var(--astryx-color-border-subtle, #f4f4f5);
    gap: var(--astryx-space-3, 12px);
  }

  .astryx-dialog-titles {
    flex: 1;
  }

  .astryx-dialog-title {
    margin: 0;
    font-size: var(--astryx-font-size-lg, 1.125rem);
    font-weight: var(--astryx-font-weight-semibold, 600);
    color: var(--astryx-color-fg-primary, #18181b);
    line-height: 1.3;
  }

  .astryx-dialog-description {
    margin: var(--astryx-space-1, 4px) 0 0 0;
    font-size: var(--astryx-font-size-sm, 0.875rem);
    color: var(--astryx-color-fg-secondary, #52525b);
    line-height: 1.4;
  }

  .astryx-dialog-close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    margin: -4px -4px 0 0;
    background: transparent;
    border: none;
    border-radius: var(--astryx-radius-md, 6px);
    color: var(--astryx-color-fg-secondary, #71717a);
    cursor: pointer;
    transition:
      background-color var(--astryx-duration-fast, 120ms) ease,
      color var(--astryx-duration-fast, 120ms) ease;
    outline: none;
  }

  .astryx-dialog-close-btn:hover {
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    color: var(--astryx-color-fg-primary, #18181b);
  }

  .astryx-dialog-close-btn:focus-visible {
    box-shadow: 0 0 0 2px var(--astryx-color-border-focus, #18181b);
  }

  .astryx-dialog-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--astryx-space-5, 20px);
    font-size: var(--astryx-font-size-sm, 0.875rem);
    line-height: 1.5;
  }

  .astryx-dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: var(--astryx-space-3, 12px) var(--astryx-space-5, 20px);
    border-top: 1px solid var(--astryx-color-border-subtle, #f4f4f5);
    background-color: var(--astryx-color-surface-subtle, #fafafa);
    gap: var(--astryx-space-2, 8px);
  }

  @keyframes astryx-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes astryx-dialog-scale-in {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
</style>
