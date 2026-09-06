<script lang="ts">
  import Fa from 'svelte-fa';
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import Popover from '$lib/components/popover/popover.svelte';
  import { pagePath } from '$lib/data/env';
  import { IconButton, Tooltip } from '@custom-ereader/ui';

  export let leavePageLink = '';
  export let items = [mergeEntries.MANAGE, mergeEntries.SETTINGS, mergeEntries.BUG_REPORT];
  export let mergeTo = mergeEntries.MANAGE;
  export let disableRouteNavigation = false;

  const dispatch = createEventDispatcher<{ action: string }>();

  $: actionItems = items.filter((item) => item.routeId !== $page.route.id);

  let menuElm: Popover;

  function handleActionMenuItem(target: string) {
    dispatch('action', target);

    if (
      !(target === mergeEntries.FILE_IMPORT.label || target === mergeEntries.FOLDER_IMPORT.label)
    ) {
      menuElm?.toggleOpen();
    }

    if (!disableRouteNavigation) {
      const action = actionItems.find((item) => item.label === target);

      if (action?.routeId) {
        goto(`${pagePath}${action.routeId}`);
      }
    }
  }

  $: if (actionItems.length === 1 && actionItems[0].routeId && !leavePageLink) {
    leavePageLink = actionItems[0].routeId;
  }
</script>

{#if leavePageLink}
  <a href={leavePageLink} class="inline-flex items-center" aria-label={mergeTo.title || 'Back'}>
    <Tooltip text={mergeTo.title || 'Back'}>
      <IconButton variant="ghost" size="md" label={mergeTo.title || 'Back'}>
        <Fa icon={mergeTo.icon} />
      </IconButton>
    </Tooltip>
  </a>
{:else}
  <div class="hidden sm:flex items-center gap-1">
    {#each actionItems as actionItem (actionItem.label)}
      <Tooltip text={actionItem.title || actionItem.label}>
        <IconButton
          variant="ghost"
          size="md"
          label={actionItem.title || actionItem.label}
          on:click={() => handleActionMenuItem(actionItem.label)}
        >
          <Fa icon={actionItem.icon} />
        </IconButton>
      </Tooltip>
    {/each}
  </div>
  <div class="flex sm:hidden items-center">
    <Popover
      placement="bottom"
      fallbackPlacements={['bottom-end', 'bottom-start']}
      yOffset={4}
      bind:this={menuElm}
    >
      <div slot="icon">
        <IconButton variant="ghost" size="md" label={mergeTo.title || 'More navigation actions'}>
          <Fa icon={mergeTo.icon} />
        </IconButton>
      </div>
      <div
        class="w-48 py-1.5 rounded-lg border shadow-lg text-sm"
        style="background-color: var(--astryx-color-surface, #ffffff); border-color: var(--astryx-color-border-default, #e4e4e7); color: var(--astryx-color-fg-primary, #18181b);"
        slot="content"
      >
        {#each actionItems as actionItem (actionItem.label)}
          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            style="color: var(--astryx-color-fg-primary, inherit);"
            on:click={() => handleActionMenuItem(actionItem.label)}
          >
            <Fa icon={actionItem.icon} class="w-4 text-center opacity-70" />
            <span>{actionItem.label}</span>
          </button>
        {/each}
      </div>
    </Popover>
  </div>
{/if}
