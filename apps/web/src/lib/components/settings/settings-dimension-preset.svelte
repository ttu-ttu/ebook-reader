<script lang="ts">
  import { tick } from 'svelte';

  export let dimensionValue = 0;
  export let isVertical = true;
  export let isFirstDimension = false;

  let presetValue = isFirstDimension ? 5 : 95;

  $: calculatedValue = Math.ceil(
    window[getDimension()] * (presetValue / 100 / (isFirstDimension ? 2 : 1))
  );

  function getDimension() {
    if (isVertical) {
      return isFirstDimension ? 'innerWidth' : 'innerHeight';
    }

    return isFirstDimension ? 'innerHeight' : 'innerWidth';
  }

  async function setToValue(val = 0) {
    presetValue = val;
    await tick();
    dimensionValue = calculatedValue;
  }

  setToValue(presetValue);
</script>

<div class="text-center">
  {presetValue}% - {calculatedValue}px
</div>
<input
  class="mb-2 mt-4"
  type="range"
  step="5"
  min={isFirstDimension ? 5 : 50}
  max={isFirstDimension ? 50 : 95}
  dir={isFirstDimension ? 'ltr' : 'rtl'}
  bind:value={presetValue}
  on:change={() => (dimensionValue = calculatedValue)}
/>
<div class="flex justify-evenly">
  <button on:click={() => setToValue(isFirstDimension ? 25 : 75)}>
    {isFirstDimension ? 25 : 75}%
  </button>
  <button on:click={() => setToValue(50)}> 50% </button>
</div>
