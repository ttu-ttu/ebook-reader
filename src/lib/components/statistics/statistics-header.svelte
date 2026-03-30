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
  import { baseHeaderClasses, baseIconClasses, pxScreen } from '$lib/css-classes';
  import { pagePath } from '$lib/data/env';
  import { lastStatisticsTab$ } from '$lib/data/store';
  import { dummyFn } from '$lib/functions/utils';
  import Fa from 'svelte-fa';

  export let currentBookId: number | undefined;
  export let showStatisticsSettings: boolean;

  const copyStatisticsDataItems: StatisticsDataSource[] = [
    { key: 'readingTime', label: 'Reading Time' },
    { key: 'charactersRead', label: 'Characters Read' }
  ];

  let copyStatisticsDataPopover: Popover;
</script>

<div class="elevation-4 fixed inset-x-0 top-0 z-10">
  <div class={baseHeaderClasses}>
    <div class="{pxScreen} flex justify-end px-0 md:px-5">
      <div class="relative transform-gpu">
        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={0}
          bind:this={copyStatisticsDataPopover}
        >
          <div title="Copy Data in TMW Log Format" slot="icon" class={baseIconClasses}>
            <Fa icon={faCopy} />
          </div>
          <div class="flex flex-col justify-center w-36 bg-gray-700" slot="content">
            {#each copyStatisticsDataItems as copyStatisticsDataItem (copyStatisticsDataItem.key)}
              <button
                class="p-2 hover:bg-white hover:text-gray-700"
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
      <div
        tabindex="0"
        role="button"
        title={$lastStatisticsTab$ === StatisticsTab.SUMMARY
          ? 'You are already on the Summary Tab'
          : 'Switch to Summary Tab'}
        class={baseIconClasses}
        class:bg-gray-900={$lastStatisticsTab$ === StatisticsTab.SUMMARY}
        on:click={() => ($lastStatisticsTab$ = StatisticsTab.SUMMARY)}
        on:keyup={dummyFn}
      >
        <Fa icon={faCalendarDays} />
      </div>
      <div
        tabindex="0"
        role="button"
        title={$lastStatisticsTab$ === StatisticsTab.OVERVIEW
          ? 'You are already on the Heatmap Tab'
          : 'Switch to Heatmap Tab'}
        class={baseIconClasses}
        class:bg-gray-900={$lastStatisticsTab$ === StatisticsTab.OVERVIEW}
        on:click={() => ($lastStatisticsTab$ = StatisticsTab.OVERVIEW)}
        on:keyup={dummyFn}
      >
        <Fa icon={faMap} />
      </div>
      <div
        tabindex="0"
        role="button"
        title="Open Title Filter Menu"
        class={baseIconClasses}
        style:cursor={$statisticsTitleFilterEnabled$ ? 'pointer' : 'not-allowed'}
        on:click={() => {
          if (!$statisticsTitleFilterEnabled$) {
            return;
          }

          $statisticsTitleFilterIsOpen$ = true;
        }}
        on:keyup={dummyFn}
      >
        <Fa icon={faFilter} />
      </div>
      <div
        tabindex="0"
        role="button"
        title="Open Statistics Settings"
        class={baseIconClasses}
        on:click={() => (showStatisticsSettings = true)}
        on:keyup={dummyFn}
      >
        <Fa icon={faSliders} />
      </div>
      {#if currentBookId}
        <svg
          tabindex="0"
          role="button"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          class={baseIconClasses}
          on:click={() => goto(`${pagePath}/b?id=${currentBookId}`)}
          on:keyup={dummyFn}
        >
          <path
            class="fill-current"
            d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5zm-3.5-8c.88 0 1.73.09 2.5.26V9.24c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99zM13 12.49v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26V11.9c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.3-4.5.83zm4.5 1.84c-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26v-1.52c-.79-.16-1.64-.24-2.5-.24z"
          />
        </svg>
      {/if}
      <MergedHeaderIcon items={[mergeEntries.SETTINGS, mergeEntries.MANAGE]} />
    </div>
  </div>
</div>
