<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { createEventDispatcher, onMount } from 'svelte';
  import { PresetStorage } from '$lib/data/window/preset-storage';

  export let affirmativeText: string = 'Save';
  export let negativeText: string = 'Cancel';
  export let initValue: string = '';
  export let onConfirm: ((presetName: string) => void) | undefined;

  let presetName = initValue;
  let presetNameElm: HTMLInputElement;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  onMount(() => {
    presetNameElm.focus();
  });

  function handleAffirmative() {
    presetNameElm.setCustomValidity('');

    if (!presetName) {
      presetNameElm.setCustomValidity('You have to enter a name!');
      presetNameElm.reportValidity();
      return;
    }

    if (PresetStorage.getPresetList().includes(presetName)) {
      presetNameElm.setCustomValidity('This name is already in use!');
      presetNameElm.reportValidity();
      return;
    }

    dispatch('close');

    if (onConfirm) {
      onConfirm(presetName);
    }
  }
</script>

<DialogTemplate>
  <div slot="content">
    <div
      class="grid grid-cols-1 gap-2 items-center overflow-auto max-h-[60vh] sm:grid-cols-[auto_auto_5rem] sm:gap-4"
    >
      <input
        class="sm:col-span-2"
        type="text"
        placeholder="Preset Name"
        bind:value={presetName}
        bind:this={presetNameElm}
      />
    </div>
    <div class="flex mt-4" />
  </div>
  <div class="mt-2 flex grow justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => dispatch('close')}>
      {negativeText}
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={handleAffirmative}>
      {affirmativeText}
      <Ripple />
    </button>
  </div>
</DialogTemplate>
