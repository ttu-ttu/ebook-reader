<script lang="ts">
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';

  export let title: string;
  export let tooltip = '';
</script>

<section class="pb-8">
  <div class="flex">
    <h2 class="mb-2 text-xl font-medium">
      {#if tooltip}
        <Popover contentText={tooltip} contentStyles="padding: 0.5rem;">
          <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
          <span class="capitalize">{title}</span>
        </Popover>
      {:else}
        <span class="capitalize">{title}</span>
      {/if}
    </h2>
    <slot name="header" />
  </div>
  <div>
    <slot />
  </div>
</section>
