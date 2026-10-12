<script lang="ts">
  import {
    faCalendarDays,
    faCopy,
    faFilter,
    faMap,
    faSliders
  } from '@fortawesome/free-solid-svg-icons';
  import AppHeader from '$lib/components/app-header/app-header.svelte';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    StatisticsTab,
    copyStatisticsData$,
    statisticsTitleFilterEnabled$,
    statisticsTitleFilterIsOpen$,
    type StatisticsDataSource
  } from '$lib/components/statistics/statistics-types';
  import { lastStatisticsTab$ } from '$lib/data/store';
  import Fa from 'svelte-fa';

  export let currentBookId: number | undefined;
  export let showStatisticsSettings: boolean;

  const copyStatisticsDataItems: StatisticsDataSource[] = [
    { key: 'readingTime', label: 'Reading Time' },
    { key: 'charactersRead', label: 'Characters Read' }
  ];

  let copyStatisticsDataPopover: Popover;
</script>

<AppHeader active="statistics" {currentBookId}>
  <button
    type="button"
    class="app-header-icon"
    class:app-header-icon-active={$lastStatisticsTab$ === StatisticsTab.SUMMARY}
    title="Summary"
    aria-label="Summary"
    aria-pressed={$lastStatisticsTab$ === StatisticsTab.SUMMARY}
    on:click={() => ($lastStatisticsTab$ = StatisticsTab.SUMMARY)}
  >
    <Fa icon={faCalendarDays} />
  </button>
  <button
    type="button"
    class="app-header-icon"
    class:app-header-icon-active={$lastStatisticsTab$ === StatisticsTab.OVERVIEW}
    title="Heatmap"
    aria-label="Heatmap"
    aria-pressed={$lastStatisticsTab$ === StatisticsTab.OVERVIEW}
    on:click={() => ($lastStatisticsTab$ = StatisticsTab.OVERVIEW)}
  >
    <Fa icon={faMap} />
  </button>
  <button
    type="button"
    class="app-header-icon"
    title="Open title filter"
    aria-label="Open title filter"
    disabled={!$statisticsTitleFilterEnabled$}
    on:click={() => ($statisticsTitleFilterIsOpen$ = true)}
  >
    <Fa icon={faFilter} />
  </button>
  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom', 'bottom-start']}
    yOffset={10}
    panelClasses="app-popover-panel"
    bind:this={copyStatisticsDataPopover}
  >
    <button
      slot="icon"
      type="button"
      class="app-header-icon"
      title="Copy data in TMW log format"
      aria-label="Copy data in TMW log format"
    >
      <Fa icon={faCopy} />
    </button>
    <div class="flex flex-col" slot="content">
      <div class="app-popover-heading">Copy as TMW log</div>
      {#each copyStatisticsDataItems as copyStatisticsDataItem (copyStatisticsDataItem.key)}
        <button
          type="button"
          class="app-popover-item"
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
  <button
    type="button"
    class="app-header-icon"
    title="Open statistics settings"
    aria-label="Open statistics settings"
    on:click={() => (showStatisticsSettings = true)}
  >
    <Fa icon={faSliders} />
  </button>
</AppHeader>
