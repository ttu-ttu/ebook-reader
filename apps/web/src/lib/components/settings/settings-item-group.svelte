<script lang="ts">
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import { setContext } from 'svelte';
  import Popover from '../popover/popover.svelte';

  export let title: string;
  /** Shown under the title (or as a popover when not a card) */
  export let tooltip = '';
  export let applyHeaderClasses = true;
  export let card = true;
  /** Control below the label instead of beside it (editors, lists, long inputs) */
  export let wide = false;

  // Names the switch or segmented control inside (button-toggle-group.svelte).
  setContext('settings-item-label', title);
</script>

{#if card}
  <section
    class="settings-item"
    class:settings-item-wide={wide}
    data-settings-item
    data-settings-search="{title} {tooltip}"
  >
    <div class="settings-item-text">
      <div class="settings-item-heading">
        <h3>{title}</h3>
        <slot name="header" />
      </div>
      {#if tooltip}
        <p class="settings-item-description">{tooltip}</p>
      {/if}
    </div>
    <div class="settings-item-control">
      <slot />
    </div>
    {#if $$slots.after}
      <div class="settings-item-after"><slot name="after" /></div>
    {/if}
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
  /* One row: label and description on the left, the control on the right. A control
     too wide for the space left wraps below the label. */
  .settings-item {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 2rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-color);
    scroll-margin-top: 6rem;
  }

  .settings-item-text {
    flex: 1 1 15rem;
    min-width: 0;
  }

  .settings-item-wide .settings-item-text,
  .settings-item-wide .settings-item-control {
    flex-basis: 100%;
  }

  .settings-item-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .settings-item-heading h3 {
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .settings-item-heading h3::first-letter {
    text-transform: uppercase;
  }

  .settings-item-description {
    margin-top: 0.2rem;
    color: var(--app-muted-fg);
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-line;
  }

  .settings-item-control {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
  }

  .settings-item-after {
    flex-basis: 100%;
    min-width: 0;
  }

  .settings-item-control :global(input:not([type='checkbox']):not([type='radio'])),
  .settings-item-control :global(select) {
    max-width: 100%;
  }

  /* Rows matching the settings search (routes/settings/+page.svelte) */
  :global([data-settings-match]).settings-item {
    margin-inline: -0.75rem;
    padding-inline: 0.75rem;
    border-radius: calc(0.4rem * var(--app-radius-scale));
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
    box-shadow: inset 2px 0 var(--accent-color);
  }
</style>
