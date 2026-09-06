<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    faCalendarDays,
    faCopy,
    faFilter,
    faMap,
    faSliders
  } from '@fortawesome/free-solid-svg-icons';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    StatisticsTab,
    copyStatisticsData$,
    statisticsTitleFilterEnabled$,
    statisticsTitleFilterIsOpen$,
    type StatisticsDataSource
  } from '$lib/components/statistics/statistics-types';
  import { pagePath } from '$lib/data/env';
  import { lastStatisticsTab$ } from '$lib/data/store';
  import { IconButton, SegmentedControl, Tooltip, TopBar } from '@custom-ereader/ui';
  import Fa from 'svelte-fa';

  export let currentBookId: number | undefined;
  export let showStatisticsSettings: boolean;

  const copyStatisticsDataItems: StatisticsDataSource[] = [
    { key: 'readingTime', label: 'Reading Time' },
    { key: 'charactersRead', label: 'Characters Read' }
  ];

  const tabOptions = [
    { value: StatisticsTab.SUMMARY, label: 'Summary' },
    { value: StatisticsTab.OVERVIEW, label: 'Heatmap' }
  ];

  let copyStatisticsDataPopover: Popover;
</script>

<TopBar bordered={true} class="shadow-sm">
  <div slot="start" class="flex items-center gap-3">
    <div class="font-semibold text-sm tracking-tight hidden md:block opacity-90 pl-1">
      Statistics
    </div>
    <SegmentedControl size="sm" options={tabOptions} bind:value={$lastStatisticsTab$} />
  </div>

  <div slot="end" class="flex items-center gap-1">
    <!-- Copy statistics data popover (hidden on very small mobile, visible on sm:) -->
    <div class="hidden sm:flex items-center">
      <Popover
        placement="bottom"
        fallbackPlacements={['bottom-end', 'bottom-start']}
        yOffset={4}
        bind:this={copyStatisticsDataPopover}
      >
        <div slot="icon">
          <Tooltip text="Copy Data in TMW Log Format">
            <IconButton variant="ghost" size="md" label="Copy Data in TMW Log Format">
              <Fa icon={faCopy} />
            </IconButton>
          </Tooltip>
        </div>
        <div
          class="w-44 py-1.5 rounded-lg border shadow-lg text-sm"
          style="background-color: var(--astryx-color-surface, #ffffff); border-color: var(--astryx-color-border-default, #e4e4e7); color: var(--astryx-color-fg-primary, #18181b);"
          slot="content"
        >
          {#each copyStatisticsDataItems as copyStatisticsDataItem (copyStatisticsDataItem.key)}
            <button
              type="button"
              class="w-full px-3.5 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              style="color: var(--astryx-color-fg-primary, inherit);"
              on:click={() => {
                copyStatisticsData$.next(copyStatisticsDataItem.key);
                copyStatisticsDataPopover.toggleOpen();
              }}
            >
              {copyStatisticsDataItem.label}
            </button>
          {/each}
        </div>
      </Popover>
    </div>

    <!-- Title Filter Trigger -->
    <Tooltip
      text={$statisticsTitleFilterEnabled$ ? 'Open Title Filter' : 'Title filter not applicable'}
    >
      <IconButton
        variant="ghost"
        size="md"
        label="Open Title Filter"
        disabled={!$statisticsTitleFilterEnabled$}
        active={$statisticsTitleFilterIsOpen$}
        on:click={() => {
          if ($statisticsTitleFilterEnabled$) {
            $statisticsTitleFilterIsOpen$ = true;
          }
        }}
      >
        <Fa icon={faFilter} />
      </IconButton>
    </Tooltip>

    <!-- Statistics Settings Trigger -->
    <Tooltip text="Statistics Settings">
      <IconButton
        variant="ghost"
        size="md"
        label="Statistics Settings"
        on:click={() => (showStatisticsSettings = true)}
      >
        <Fa icon={faSliders} />
      </IconButton>
    </Tooltip>

    <!-- Back to current book button -->
    {#if currentBookId}
      <Tooltip text="Back to Current Book">
        <IconButton
          variant="ghost"
          size="md"
          label="Back to Current Book"
          on:click={() => goto(`${pagePath}/b?id=${currentBookId}`)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
          >
            <path
              d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5zm-3.5-8c.88 0 1.73.09 2.5.26V9.24c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99zM13 12.49v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26V11.9c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.3-4.5.83zm4.5 1.84c-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26v-1.52c-.79-.16-1.64-.24-2.5-.24z"
            />
          </svg>
        </IconButton>
      </Tooltip>
    {/if}

    <!-- Shared Navigation Hub -->
    <MergedHeaderIcon items={[mergeEntries.SETTINGS, mergeEntries.MANAGE]} />
  </div>
</TopBar>
