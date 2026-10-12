<script lang="ts">
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';

  export let title: string;
  /** Shown under the title (or as a popover when not a card) */
  export let tooltip = '';
  export let applyHeaderClasses = true;
  export let card = true;
  /** Spans both columns of the settings grid */
  export let wide = false;
</script>

{#if card}
  <section
    class="settings-item"
    class:settings-item-wide={wide}
    data-settings-item
    data-settings-search="{title} {tooltip}"
  >
    <div class="settings-item-heading">
      <h3 class="capitalize">{title}</h3>
      <slot name="header" />
    </div>
    {#if tooltip}
      <p class="settings-item-description">{tooltip}</p>
    {/if}
    <div class="settings-item-control">
      <slot />
    </div>
  </section>
{:else}
  <section class="pb-8 md:pb-3">
    <div class="flex">
      <h2 class="mb-2" class:text-base={applyHeaderClasses} class:font-bold={applyHeaderClasses}>
        {#if tooltip}
          <Popover contentText={tooltip} contentStyles="padding: 0.5rem;">
            <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
            <span class="capitalize">{title}</span>
          </Popover>
        {:else}
          <span class="capitalize">{title}</span>
        {/if}
      </h2>
      <slot name="header" />
    </div>
    <div>
      <slot />
    </div>
  </section>
{/if}

<style>
  .settings-item {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.45rem;
    padding: 1rem 1rem 1.05rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
    border-radius: calc(1.2rem * var(--app-radius-scale));
    background: color-mix(in srgb, var(--surface-color) 96%, var(--background-color));
    box-shadow: inset 0 1px color-mix(in srgb, var(--app-inset-highlight) 45%, transparent);
  }

  .settings-item-wide {
    grid-column: 1 / -1;
  }

  .settings-item-heading {
    display: flex;
    min-height: 1.5rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .settings-item-heading h3 {
    font-size: 0.98rem;
    font-weight: 650;
    line-height: 1.2;
  }

  .settings-item-description {
    color: var(--app-muted-fg);
    font-size: 0.8rem;
    font-weight: 550;
    line-height: 1.4;
    white-space: pre-line;
  }

  .settings-item-control {
    margin-top: auto;
    padding-top: 0.35rem;
  }

  .settings-item-control :global(input:not([type='checkbox']):not([type='radio'])),
  .settings-item-control :global(select) {
    max-width: 100%;
  }
</style>
