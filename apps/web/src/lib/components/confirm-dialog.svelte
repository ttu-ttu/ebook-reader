<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { createEventDispatcher } from 'svelte';

  export let dialogHeader: string;
  export let dialogMessage: string;
  export let contentStyles: string = '';
  export let showCancel = true;
  export let cancelLabel = 'Cancel';
  export let confirmLabel = 'Confirm';
  export let resolver: (arg0: boolean) => void;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function closeDialog(wasCanceled = false) {
    resolver(wasCanceled);
    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="header">{dialogHeader}</svelte:fragment>
  <svelte:fragment slot="content">
    <p style={contentStyles}>{dialogMessage}</p>
  </svelte:fragment>
  <div class="flex grow justify-between" slot="footer">
    <button class={buttonClasses} class:invisible={!showCancel} on:click={() => closeDialog(true)}>
      {cancelLabel}
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={() => closeDialog()}>
      {confirmLabel}
      <Ripple />
    </button>
  </div>
</DialogTemplate>
