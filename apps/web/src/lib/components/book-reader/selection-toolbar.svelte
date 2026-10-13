<script lang="ts">
  import { faNoteSticky } from '@fortawesome/free-solid-svg-icons';
  import { highlightColors, type HighlightColor } from '$lib/data/annotations';
  import { activePlugins$, type SelectionActionContribution } from '$lib/plugins';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  /** The Listen panel is open at the bottom, so show at the top instead */
  export let raised = false;

  const dispatch = createEventDispatcher<{
    highlight: HighlightColor;
    note: void;
    action: SelectionActionContribution;
  }>();
</script>

<div
  class="reader-panel writing-horizontal-tb fixed left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1.5 text-sm shadow-lg {raised
    ? 'top-12'
    : 'bottom-10'}"
  role="toolbar"
  aria-label="Selection actions"
>
  {#each highlightColors as color (color)}
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-full"
      title="Highlight ({color})"
      on:mousedown|preventDefault
      on:click={() => dispatch('highlight', color)}
    >
      <span class="color-dot" style:background-color="var(--highlight-{color})" />
    </button>
  {/each}
  <span class="reader-panel-divider mx-1 h-5 border-l" />
  <button
    type="button"
    class="flex h-8 items-center gap-1.5 rounded-full px-2.5"
    title="Highlight and add a note"
    on:mousedown|preventDefault
    on:click={() => dispatch('note')}
  >
    <Fa icon={faNoteSticky} />
    <span class="hidden sm:inline">Note</span>
  </button>
  {#each $activePlugins$.flatMap((plugin) => plugin.selectionActions ?? []) as action (action.label)}
    <button
      type="button"
      class="flex h-8 items-center gap-1.5 rounded-full px-2.5"
      title={action.title}
      on:mousedown|preventDefault
      on:click={() => dispatch('action', action)}
    >
      <Fa icon={action.icon} />
      {action.label}
    </button>
  {/each}
</div>

<style>
  button:hover {
    background: color-mix(in srgb, var(--reader-panel-fg) 12%, transparent);
  }

  .color-dot {
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid color-mix(in srgb, var(--reader-panel-fg) 50%, transparent);
    border-radius: 9999px;
  }
</style>
