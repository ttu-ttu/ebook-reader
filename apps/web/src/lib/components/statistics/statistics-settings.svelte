<script lang="ts">
  import {
    faCircleQuestion,
    faLeftLong,
    faRightLong,
    faSpinner,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    type StatisticsDateChange,
    statisticsRangeTemplates,
    readingTimeDataSources,
    charactersDataSources,
    readingSpeedDataSources,
    statisticsDataAggregrationModes,
    exportStatisticsData$,
    statisticsSettingsActionInProgress$
  } from '$lib/components/statistics/statistics-types';
  import { daysOfWeek } from '$lib/components/statistics/statistics-heatmap/statistics-heatmap';
  import { dialogManager } from '$lib/data/dialog-manager';
  import {
    lastCharactersDataSource$,
    lastPrimaryReadingDataAggregationMode$,
    lastReadingSpeedDataSource$,
    lastReadingTimeDataSource$,
    lastStartDayOfWeek$,
    lastStatisticsEndDate$,
    lastStatisticsRangeTemplate$,
    lastStatisticsStartDate$
  } from '$lib/data/store';
  import { createEventDispatcher, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  const dispatch = createEventDispatcher<{
    close: void;
    statisticsDateChange: StatisticsDateChange;
  }>();

  const weekDays = [...daysOfWeek.slice(1, 7), daysOfWeek[0]].map((day, index) => {
    if (day === 'Sunday') {
      return { day, index: 0 };
    }
    return { day, index: index + 1 };
  });

  $: selectedStatisticsStartDate = $lastStatisticsStartDate$;

  $: selectedStatisticsEndDate = $lastStatisticsEndDate$;

  onMount(() => {
    dialogManager.dialogs$.next([{ component: '<div/>' }]);

    return () => dialogManager.dialogs$.next([]);
  });

  async function exportStatisticsData(exportAllStatisticsData = true) {
    $statisticsSettingsActionInProgress$ = true;

    exportStatisticsData$.next(exportAllStatisticsData);
  }
</script>

{#if $statisticsSettingsActionInProgress$}
  <div class="tap-highlight-transparent absolute inset-0 bg-black/[.2]" />
  <div class="flex items-center justify-center absolute h-full w-full text-7xl inset-0">
    <Fa icon={faSpinner} spin />
  </div>
{/if}
<div class="flex items-center p-4">
  <button class="flex items-end md:items-center" on:click={() => dispatch('close')}>
    <Fa icon={faXmark} />
  </button>
  <div class="flex flex-1 justify-end">
    <button class="mr-4 hover:text-red-500" on:click={() => exportStatisticsData(false)}>
      Export Selection
    </button>
    <button class="hover:text-red-500" on:click={() => exportStatisticsData()}>Export All</button>
  </div>
</div>
<div class="flex-1 p-4 overflow-auto">
  <div class="flex flex-col mb-6">
    <label for="datesTemplate">Template</label>
    <select id="datesTemplate" class="text-black" bind:value={$lastStatisticsRangeTemplate$}>
      {#each statisticsRangeTemplates as statisticsRangeTemplate (statisticsRangeTemplate)}
        <option value={statisticsRangeTemplate}>
          {statisticsRangeTemplate}
        </option>
      {/each}
    </select>
  </div>
  <div class="flex flex-col mb-4 sm:hidden">
    <label for="weekDay">Start of Week</label>
    <select id="weekDay" class="text-black" bind:value={$lastStartDayOfWeek$}>
      {#each weekDays as weekDay (weekDay.day)}
        <option value={weekDay.index}>
          {weekDay.day}
        </option>
      {/each}
    </select>
  </div>
  <div class="flex justify-between sm:flex-row">
    <div class="flex flex-col">
      <label for="fromDate">From</label>
      <input
        id="fromDate"
        type="date"
        class="text-black"
        bind:value={selectedStatisticsStartDate}
        on:change={() =>
          dispatch('statisticsDateChange', {
            isStartDate: true,
            dateString: selectedStatisticsStartDate
          })}
      />
    </div>
    <div class="flex flex-col justify-between pt-4 mx-2 text-xl sm:mx-0">
      <button
        on:click={() =>
          dispatch('statisticsDateChange', {
            isStartDate: false,
            dateString: selectedStatisticsStartDate
          })}
      >
        <Fa icon={faRightLong} />
      </button>
      <button
        on:click={() =>
          dispatch('statisticsDateChange', {
            isStartDate: true,
            dateString: selectedStatisticsEndDate
          })}
      >
        <Fa icon={faLeftLong} />
      </button>
    </div>
    <div class="flex flex-col">
      <label for="toDate">To</label>
      <input
        id="toDate"
        type="date"
        class="text-black"
        bind:value={selectedStatisticsEndDate}
        on:change={() =>
          dispatch('statisticsDateChange', {
            isStartDate: false,
            dateString: selectedStatisticsEndDate
          })}
      />
    </div>
    <div class="flex-col hidden sm:flex">
      <label for="weekDay">Start of Week</label>
      <select id="weekDay" class="text-black" bind:value={$lastStartDayOfWeek$}>
        {#each weekDays as weekDay (weekDay.day)}
          <option value={weekDay.index}>
            {weekDay.day}
          </option>
        {/each}
      </select>
    </div>
  </div>
  <div class="flex flex-wrap justify-between mt-4">
    <div class="flex flex-col my-2 w-full sm:w-[initial]">
      <Popover
        contentText={'Reading Time Attribute which should be used for the Summary Tab'}
        contentStyles="padding: 0.5rem;"
      >
        <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
        <label for="timeDataSource">Time Data Source</label>
      </Popover>
      <select id="timeDataSource" class="text-black" bind:value={$lastReadingTimeDataSource$}>
        {#each readingTimeDataSources as readingTimeDataSource (readingTimeDataSource.key)}
          <option value={readingTimeDataSource.key}>
            {readingTimeDataSource.label}
          </option>
        {/each}
      </select>
    </div>
    <div class="flex flex-col my-2 w-full sm:w-[initial]">
      <Popover
        contentText={'Characters Read Attribute which should be used for the Summary Tab'}
        contentStyles="padding: 0.5rem; max-width: 20rem;"
      >
        <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
        <label for="charactersSource">Characters Data Source</label>
      </Popover>
      <select id="charactersSource" class="text-black" bind:value={$lastCharactersDataSource$}>
        {#each charactersDataSources as charactersDataSource (charactersDataSource.key)}
          <option value={charactersDataSource.key}>
            {charactersDataSource.label}
          </option>
        {/each}
      </select>
    </div>
    <div class="flex flex-col my-2 w-full sm:w-[initial]">
      <Popover
        contentText={'Reading Speed Attribute which should be used for the Summary Tab'}
        contentStyles="padding: 0.5rem;"
      >
        <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
        <label for="speedSource">Speed Data Source</label>
      </Popover>
      <select id="speedSource" class="text-black" bind:value={$lastReadingSpeedDataSource$}>
        {#each readingSpeedDataSources as readingSpeedDataSource (readingSpeedDataSource.key)}
          <option value={readingSpeedDataSource.key}>
            {readingSpeedDataSource.label}
          </option>
        {/each}
      </select>
    </div>
  </div>
  <div class="flex flex-col mt-4">
    <Popover
      contentText={'Determines on which primary Attribute the Data will be grouped for the Summary Tab'}
      contentStyles="padding: 0.5rem;"
    >
      <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
      <label for="primaryAggregration">Primary Aggregration</label>
    </Popover>
    <select
      id="primaryAggregration"
      class="text-black"
      bind:value={$lastPrimaryReadingDataAggregationMode$}
    >
      {#each statisticsDataAggregrationModes as statisticsDataAggregrationMode (statisticsDataAggregrationMode)}
        <option value={statisticsDataAggregrationMode}>
          {statisticsDataAggregrationMode}
        </option>
      {/each}
    </select>
  </div>
</div>
