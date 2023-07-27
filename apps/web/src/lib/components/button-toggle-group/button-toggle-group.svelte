<script lang="ts">
  import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import Ripple from '$lib/components/ripple.svelte';
  import { availableThemes } from '$lib/data/theme-option';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let options: ToggleOption<any>[];

  export let selectedOptionId: any;

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
        class="m-1 rounded-md border-2 border-gray-400 p-2 text-lg"
        class:border-4={option.thickBorders && option.id === selectedOptionId}
        class:border-blue-300={option.id === selectedOptionId}
        class:bg-gray-700={option.id === selectedOptionId}
        class:text-white={option.id === selectedOptionId}
        class:bg-white={option.id !== selectedOptionId}
        style={mapToStyleString(option.style)}
        on:click={() => (selectedOptionId = option.id)}
      >
        {option.text}
        <Ripple />
      </button>
      {#if option.showIcons && option.id === selectedOptionId && !availableThemes.has(option.id)}
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
