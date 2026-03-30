<script lang="ts">
  import { afterUpdate, createEventDispatcher } from 'svelte';

  export let html: string;

  const dispatch = createEventDispatcher<{
    load: void;
  }>();

  afterUpdate(() => {
    dispatch('load');
  });
</script>

{@html html}
