<script type="ts">
  import { faArrowDown19, faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';
  import DimensionPreset from './settings-dimension-preset.svelte';

  export let title: string;
  export let withDimensionSlider = false;
  export let tooltip = '';
  export let dimensionValue = 0;
  export let isVertical = true;
  export let isFirstDimension = false;
</script>

<section class="pb-8">
  <h2 class="mb-2 text-xl font-medium">
    {#if withDimensionSlider}
      <Popover>
        <Fa icon={faArrowDown19} slot="icon" />
        <DimensionPreset slot="content" {isVertical} {isFirstDimension} bind:dimensionValue />
        <span class="capitalize">{title}</span>
      </Popover>
    {:else if tooltip}
      <Popover contentText={tooltip}>
        <Fa icon={faCircleQuestion} slot="icon" />
        <span class="capitalize">{title}</span>
      </Popover>
    {:else}
      <span class="capitalize">{title}</span>
    {/if}
  </h2>
  <div>
    <slot />
  </div>
</section>
