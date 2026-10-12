<script lang="ts">
  import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import { builtInThemeIds } from '$lib/data/theme/themes';
  import { createEventDispatcher, getContext } from 'svelte';
  import Fa from 'svelte-fa';

  export let options: ToggleOption<any>[];
  export let selectedOptionId: any;
  export let invertColors = false;

  const dispatch = createEventDispatcher<{
    edit: string;
    delete: string;
  }>();
  /** Title of the settings row around it (settings-item-group.svelte), for screen readers */
  const label = getContext<string | undefined>('settings-item-label');

  /** Off/On pairs are a switch; anything else is a segmented control. */
  $: isSwitch =
    options.length === 2 && options[0].id === false && options[1].id === true && !$$slots.default;

  function mapToStyleString(style: Record<string, any> | undefined) {
    if (!style) return '';

    return Object.entries(style)
      .map(([key, value]) => `${key}: ${value}`)
      .join(';');
  }

  function onSegmentKeydown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];

    if (!step) {
      return;
    }

    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    selectedOptionId = options[next].id;
    const group = (event.currentTarget as HTMLElement).parentElement?.parentElement;
    group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
</script>

{#if isSwitch}
  <button
    type="button"
    role="switch"
    class="app-switch"
    aria-checked={!!selectedOptionId}
    aria-label={label}
    on:click={() => (selectedOptionId = !selectedOptionId)}
  >
    <span class="app-switch-thumb" />
    <span class="app-switch-text">{selectedOptionId ? 'On' : 'Off'}</span>
  </button>
{:else}
  <div class="segmented" role="radiogroup" aria-label={label}>
    {#each options as option, index}
      <div class="flex">
        <button
          type="button"
          role="radio"
          aria-checked={option.id === selectedOptionId}
          tabindex={option.id === selectedOptionId ? 0 : -1}
          title={typeof option.id === 'string' ? option.id : undefined}
          class="segment"
          class:segment-selected={option.id === selectedOptionId}
          class:segment-thick={option.thickBorders}
          class:segment-inverted={invertColors}
          style={mapToStyleString(option.style)}
          on:click={() => (selectedOptionId = option.id)}
          on:keydown={(event) => onSegmentKeydown(event, index)}
        >
          {option.text}
        </button>
        {#if option.showIcons && option.id === selectedOptionId && !builtInThemeIds.has(option.id)}
          <div class="mx-1 flex flex-col justify-around">
            <button title="Edit" on:click={() => dispatch('edit', option.id)}>
              <Fa icon={faPen} />
            </button>
            <button title="Delete" on:click={() => dispatch('delete', option.id)}>
              <Fa icon={faTrash} />
            </button>
          </div>
        {/if}
      </div>
    {/each}

    <slot />
  </div>
{/if}

<style>
  .segmented {
    display: inline-flex;
    max-width: 100%;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--app-control-border);
    border-radius: calc(0.55rem * var(--app-radius-scale));
    background: var(--app-control-bg);
  }

  .segment {
    min-height: 2rem;
    padding: 0.25rem 0.8rem;
    border-radius: calc(0.4rem * var(--app-radius-scale));
    color: var(--app-muted-fg);
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .segment:hover {
    color: var(--font-color);
  }

  .segment-selected {
    background: color-mix(in srgb, var(--accent-color) 14%, var(--surface-strong-color));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 45%, transparent);
    color: var(--font-color);
    font-weight: 650;
  }

  /* Option previews (e.g. colours) keep their own look; selection shows as a ring. */
  .segment-thick.segment-selected {
    box-shadow: inset 0 0 0 2px var(--accent-color);
  }

  .segment-inverted {
    background: var(--font-color);
    color: var(--background-color);
  }
</style>
