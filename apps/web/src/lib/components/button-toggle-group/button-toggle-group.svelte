<script lang="ts">
  import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import Ripple from '$lib/components/ripple.svelte';
  import { builtInThemeIds } from '$lib/data/theme/themes';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let options: ToggleOption<any>[];
  export let selectedOptionId: any;
  export let invertColors = false;

  const dispatch = createEventDispatcher<{
    edit: string;
    delete: string;
  }>();

  function mapToStyleString(style: Record<string, any> | undefined) {
    if (!style) return '';

    return Object.entries(style)
      .map(([key, value]) => `${key}: ${value}`)
      .join(';');
  }
</script>

<div class="-m-1 flex flex-wrap">
  {#each options as option}
    <div class="flex">
      <button
        title={option.id}
        class="toggle-option m-1 rounded-md border-2 p-2 text-lg"
        class:border-4={option.thickBorders && option.id === selectedOptionId}
        class:toggle-option-selected={option.id === selectedOptionId}
        class:toggle-option-inverted={(option.id === selectedOptionId && invertColors) ||
          (option.id !== selectedOptionId && invertColors)}
        style={mapToStyleString(option.style)}
        on:click={() => (selectedOptionId = option.id)}
      >
        {option.text}
        <Ripple />
      </button>
      {#if option.showIcons && option.id === selectedOptionId && !builtInThemeIds.has(option.id)}
        <div class="flex flex-col justify-around mr-2">
          <button on:click={() => dispatch('edit', option.id)}>
            <Fa icon={faPen} slot="icon" />
          </button>
          <button on:click={() => dispatch('delete', option.id)}>
            <Fa icon={faTrash} slot="icon" />
          </button>
        </div>
      {/if}
    </div>
  {/each}

  <slot />
</div>

<style>
  .toggle-option {
    border-color: var(--app-control-border);
    background-color: var(--app-control-bg);
    color: var(--font-color);
  }

  .toggle-option-selected {
    border-color: var(--accent-color);
    background-color: color-mix(in srgb, var(--accent-color) 22%, var(--surface-strong-color));
  }

  .toggle-option-inverted {
    background-color: var(--font-color);
    color: var(--background-color);
  }
</style>
