<script lang="ts">
  import Ripple from '$lib/components/ripple.svelte';
  import type { ToggleOption } from './toggle-option';

  export let options: ToggleOption<any>[];

  export let selectedOptionId: any;

  function mapToStyleString(style: Record<string, any> | undefined) {
    if (!style) return '';

    return Object.entries(style)
      .map(([key, value]) => `${key}: ${value}`)
      .join(';');
  }
</script>

<div class="-m-1">
  {#each options as option}
    <button
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
  {/each}
</div>
