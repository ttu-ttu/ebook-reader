<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { hideExternalReadHint$ } from '$lib/data/store';
  import { createEventDispatcher } from 'svelte';

  export let hasLocalBookData: boolean;
  export let resolver: (arg0: string) => void;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function closeDialog(result = '') {
    resolver(result);
    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="header">External Read</svelte:fragment>
  <svelte:fragment slot="content">
    {#if hasLocalBookData}
      <p class="my-2">You are opening a book from an external storage Source.</p>
      <p class="my-2">Note: This may override configured sync target configurations.</p>
    {:else}
      <p class="my-2">
        You are opening a book from an external storage Source without matching local book data.
      </p>
      <p class="my-2">
        Note: This will redownload the complete book every time and may override configured sync
        target configurations.
      </p>
    {/if}
    <p class="my-2">
      Consider an export to the local browser and reading from browser storage view to prevent such
      behaviour.
    </p>
    <p class="flex items-center mt-4">
      <input id="show-hint" type="checkbox" bind:checked={$hideExternalReadHint$} />
      <label class="ml-2" for="show-hint">Remember and hide this message</label>
    </p>
  </svelte:fragment>
  <div class="flex flex-col sm:flex-row grow sm:justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => closeDialog('cancel')}>
      Cancel
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={() => closeDialog('export')}>
      Open Export
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={() => closeDialog()}>
      Confirm
      <Ripple />
    </button>
  </div>
</DialogTemplate>
