<script lang="ts">
  import Fa from 'svelte-fa';
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import Popover from '$lib/components/popover/popover.svelte';
  import { baseIconClasses } from '$lib/css-classes';

  export let leavePageLink = '';
  export let items = [mergeEntries.MANAGE, mergeEntries.BUG_REPORT, mergeEntries.SETTINGS];
  export let mergeTo = mergeEntries.MANAGE;
  export let disableRouteNavigation = false;

  const dispatch = createEventDispatcher<{ action: string }>();

  const actionItems = items.filter((item) => item.routeId !== $page.routeId);

  let menuElm: Popover;

  function handleActionMenuItem(target: string) {
    dispatch('action', target);

    if (
      !(target === mergeEntries.FILE_IMPORT.label || target === mergeEntries.FOLDER_IMPORT.label)
    ) {
      menuElm.toggleOpen();
    }

    if (!disableRouteNavigation) {
      const action = actionItems.find((item) => item.label === target);

      if (action?.routeId) {
        goto(`${action.routeId}`);
      }
    }
  }

  if (actionItems.length === 1 && actionItems[0].routeId) {
    leavePageLink = actionItems[0].routeId;
  }
</script>

{#if leavePageLink}
  <a href={leavePageLink}>
    <div class={baseIconClasses}>
      <Fa icon={mergeTo.icon} />
    </div>
  </a>
{:else}
  <div class="hidden sm:flex">
    {#each actionItems as actionItem (actionItem.label)}
      <div class={baseIconClasses} on:click={() => handleActionMenuItem(actionItem.label)}>
        <Fa icon={actionItem.icon} />
      </div>
    {/each}
  </div>
  <div class="flex sm:hidden ">
    <Popover
      placement="bottom"
      fallbackPlacements={['bottom-end', 'bottom-start']}
      yOffset={0}
      bind:this={menuElm}
    >
      <div slot="icon" class={baseIconClasses}>
        <Fa icon={mergeTo.icon} />
      </div>
      <div class="w-40 bg-gray-700 md:w-32" slot="content">
        {#each actionItems as actionItem (actionItem.label)}
          <div
            role="button"
            class="cursor-pointer px-4 py-2 text-sm hover:bg-white hover:text-gray-700"
            on:click={() => handleActionMenuItem(actionItem.label)}
          >
            {actionItem.label}
          </div>
        {/each}
      </div>
    </Popover>
  </div>
{/if}
