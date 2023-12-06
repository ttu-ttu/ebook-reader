<script lang="ts">
  import { faFont } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import { LocalFont } from '$lib/data/fonts';
  import { dummyFn } from '$lib/functions/utils';
  import Fa from 'svelte-fa';

  export let availableFonts: LocalFont[] = [LocalFont.NOTOSANSJP];
  export let fontValue: string;

  let element: Popover;
</script>

<Popover bind:this={element} placement="bottom">
  <Fa icon={faFont} slot="icon" class="mx-2" />
  <div slot="content">
    {#each availableFonts as font (font)}
      <div
        tabindex="0"
        role="button"
        class="px-4 py-2 hover:bg-gray-900"
        on:click={() => {
          fontValue = font;
          element.toggleOpen();
        }}
        on:keyup={dummyFn}
      >
        {font}
      </div>
    {/each}
  </div>
</Popover>
