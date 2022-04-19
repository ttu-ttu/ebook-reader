<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { buttonClasses } from '$lib/css-classes';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();
</script>

<DialogTemplate>
  <svelte:fragment slot="header">Update Available</svelte:fragment>
  <svelte:fragment slot="content">
    <p>An update is available, reload now?</p>
  </svelte:fragment>
  <svelte:fragment slot="footer">
    <button class={buttonClasses} on:click={() => dispatch('close')}>
      Later
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={() => document.location.reload()}>
      Reload
      <Ripple />
    </button>
  </svelte:fragment>
</DialogTemplate>
