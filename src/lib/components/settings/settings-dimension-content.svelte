<script lang="ts">
  import { onMount, tick } from 'svelte';

  export let dimensionValue = 0;
  export let isVertical = true;
  export let isFirstDimension = false;

  const progressStep = 5;

  let presetValue = 0;

  $: calculatedValue = Math.ceil(
    window[getDimension()] * (presetValue / 100 / (isFirstDimension ? 2 : 1))
  );
  $: min = isFirstDimension ? 5 : 50;
  $: max = isFirstDimension ? 50 : 95;
  $: quarter = isFirstDimension ? 25 : 75;

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

  onMount(() => {
    const currentPercentage = Math.min(
      Math.max(
        Math.round(((dimensionValue * (isFirstDimension ? 2 : 1)) / window[getDimension()]) * 100),
        !isFirstDimension && !dimensionValue ? max : min
      ),
      max
    );
    setToValue(Math.round(currentPercentage / progressStep) * progressStep);
  });
</script>

<div class="text-center">
  {presetValue}% - {calculatedValue}px
</div>
<input
  class="mb-2 mt-4"
  type="range"
  step={progressStep}
  {min}
  {max}
  bind:value={presetValue}
  on:change={() => (dimensionValue = calculatedValue)}
/>
<div class="flex justify-evenly">
  <button on:click={() => setToValue(quarter)}>
    {quarter}%
  </button>
  <button on:click={() => setToValue(50)}> 50% </button>
</div>
