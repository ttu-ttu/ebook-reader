<script type="ts">
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover.svelte';

  export let title: string;
  export let asGrid = false;
  export let columns = 3;
  export let tooltip = '';

  $: containerClasses = asGrid ? `grid md:grid-cols-${columns} gap-x-8` : '';
</script>

<section class="pb-8">
  <h2 class="mb-2 text-xl font-medium">
    {#if tooltip}
      <Popover content={tooltip}>
        <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
        <span class="capitalize">{title}</span>
      </Popover>
    {:else}
      <span class="capitalize">{title}</span>
    {/if}
  </h2>
  <div class={containerClasses}>
    <slot />
  </div>
</section>
