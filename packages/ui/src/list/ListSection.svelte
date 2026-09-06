<script lang="ts">
  import List from './List.svelte';
  import type { ListDensity } from '../types';

  export let title: string = '';
  export let description: string = '';
  export let card: boolean = true;
  export let divided: boolean = true;
  export let density: ListDensity = 'normal';
  let customClass: string = '';
  export { customClass as class };
</script>

<section class="astryx-list-section {customClass}" {...$$restProps}>
  {#if title || description || $$slots.header || $$slots.action}
    <div class="astryx-list-section-header">
      <div class="astryx-list-section-titles">
        {#if $$slots.header}
          <slot name="header" />
        {:else if title}
          <h3 class="astryx-list-section-title">{title}</h3>
        {/if}

        {#if description}
          <p class="astryx-list-section-desc">{description}</p>
        {/if}
      </div>

      {#if $$slots.action}
        <div class="astryx-list-section-action">
          <slot name="action" />
        </div>
      {/if}
    </div>
  {/if}

  {#if card}
    <List variant="card" {divided} {density}>
      <slot />
    </List>
  {:else}
    <div class="astryx-list-section-body">
      <slot />
    </div>
  {/if}

  {#if $$slots.footer}
    <div class="astryx-list-section-footer">
      <slot name="footer" />
    </div>
  {/if}
</section>

<style>
  .astryx-list-section {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-bottom: var(--astryx-space-6, 24px);
    box-sizing: border-box;
    font-family: var(--astryx-font-family-sans, sans-serif);
  }

  .astryx-list-section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: var(--astryx-space-2-5, 10px);
    padding: 0 var(--astryx-space-1, 4px);
    gap: var(--astryx-space-3, 12px);
  }

  .astryx-list-section-titles {
    display: flex;
    flex-direction: column;
    gap: var(--astryx-space-0-5, 2px);
    flex: 1;
    min-width: 0;
  }

  .astryx-list-section-title {
    margin: 0;
    font-size: var(--astryx-font-size-md, 1rem);
    font-weight: var(--astryx-font-weight-semibold, 600);
    color: var(--astryx-color-fg-primary, #18181b);
    line-height: 1.35;
    letter-spacing: -0.01em;
  }

  .astryx-list-section-desc {
    margin: 0;
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-fg-secondary, #71717a);
    line-height: 1.4;
  }

  .astryx-list-section-action {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .astryx-list-section-body {
    width: 100%;
  }

  .astryx-list-section-footer {
    margin-top: var(--astryx-space-2, 8px);
    padding: 0 var(--astryx-space-1, 4px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-fg-muted, #71717a);
    line-height: 1.4;
  }
</style>
