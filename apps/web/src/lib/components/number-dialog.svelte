<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { createEventDispatcher } from 'svelte';

  export let dialogHeader: string;
  export let showCancel = true;
  export let minValue = 1;
  export let maxValue = 1;
  export let resolver: (arg0: number | undefined) => void;

  let target = 0;
  let error = '';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function closeDialog(position?: number) {
    if (typeof position === 'number' && (position < minValue || position > maxValue)) {
      error = `Must be between ${minValue} and ${maxValue}`;
      return;
    }
    resolver(position);
    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="header">{dialogHeader}</svelte:fragment>
  <div class="flex flex-col text-sm sm:text-base" slot="content">
    <input
      type="number"
      min={minValue}
      max={maxValue}
      bind:value={target}
      on:keyup={(evt) => {
        if (evt.key === 'Enter') {
          closeDialog(target);
        }
      }}
    />
    <div class="text-red-500">{error}</div>
  </div>
  <div class="flex grow justify-between" slot="footer">
    <button
      class={buttonClasses}
      class:invisible={!showCancel}
      on:click={() => closeDialog(undefined)}
    >
      Cancel
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={() => closeDialog(target)}>
      Confirm
      <Ripple />
    </button>
  </div>
</DialogTemplate>
