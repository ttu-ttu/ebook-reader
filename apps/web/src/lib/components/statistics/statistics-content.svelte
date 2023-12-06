<script lang="ts">
  import { onKeyUpStatisticsTab } from '../../../routes/b/on-keydown-reader';
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import { getDefaultStatistic } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import { HeatmapType } from '$lib/components/statistics/statistics-heatmap/statistics-heatmap';
  import StatisticsHeatmap from '$lib/components/statistics/statistics-heatmap/statistics-heatmap.svelte';
  import StatisticsSummary from '$lib/components/statistics/statistics-summary/statistics-summary.svelte';
  import StatisticsTitleFilter from '$lib/components/statistics/statistics-title-filter.svelte';
  import {
    type BookStatistic,
    StatisticsTab,
    StatisticsReadingDataAggregationMode,
    statisticsRangeTemplates,
    copyStatisticsData$,
    statisticsTitleFilterEnabled$,
    statisticsTitleFilterIsOpen$,
    type StatisticsTitleFilterItem,
    preFilteredTitlesForStatistics$,
    statisticsDataAggregrationModes,
    exportStatisticsData$,
    statisticsSettingsActionInProgress$
  } from '$lib/components/statistics/statistics-types';
  import type {
    BooksDbReadingGoal,
    BooksDbStatistic
  } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { logger } from '$lib/data/logger';
  import { getDateRangeLabel } from '$lib/data/reading-goal';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import { StorageDataType, StorageKey } from '$lib/data/storage/storage-types';
  import {
    database,
    lastPrimaryReadingDataAggregationMode$,
    lastReadingDataHeatmapAggregationMode$,
    lastReadingGoalsHeatmapAggregationMode$,
    lastStatisticsEndDate$,
    lastStatisticsRangeTemplate$,
    lastStatisticsStartDate$,
    lastStatisticsTab$,
    skipKeyDownListener$,
    startDayHoursForTracker$,
    statisticsTabKeybindMap$
  } from '$lib/data/store';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import {
    getDateString,
    getNumberFromObject,
    getStartHoursDate,
    secondsToMinutes
  } from '$lib/functions/statistic-util';
  import { clickOutside } from '$lib/functions/use-click-outside';
  import pLimit from 'p-limit';
  import { tap } from 'rxjs';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { quintInOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  const copyStatisticsDataHandler$ = copyStatisticsData$.pipe(
    tap((dataKeyToCopy) => {
      const statistics =
        $lastPrimaryReadingDataAggregationMode$ === StatisticsReadingDataAggregationMode.TITLE
          ? aggregratedStatistics
          : getAggregatedStatistics(StatisticsReadingDataAggregationMode.TITLE);

      let logKey = '';

      switch (dataKeyToCopy) {
        case 'readingTime':
          logKey = 'readtime';
          break;

        default:
          logKey = 'reading';
          break;
      }

      const dataLines = [`Reading Data for ${statisticsDateRangeLabel}\n`];

      for (let index = 0, { length } = statistics; index < length; index += 1) {
        const statistic = statistics[index];

        let loggedValue = 0;

        if (dataKeyToCopy === 'readingTime') {
          loggedValue = Math.floor(secondsToMinutes(statistic.readingTime));
        } else {
          loggedValue = getNumberFromObject(statistic, dataKeyToCopy);
        }

        if (loggedValue) {
          dataLines.push(`.log ${logKey} ${loggedValue} ${statistic.title}`);
        }
      }

      if (dataLines.length > 1) {
        navigator.clipboard
          .writeText(dataLines.join('\n'))
          .catch((error) => logger.error(`Error writing to clipboard: ${error.message}`));
      }
    }),
    reduceToEmptyString()
  );

  const exportStatisticsDataHandler$ = exportStatisticsData$.pipe(
    tap(async (exportAllData) => {
      try {
        const statisticsDataToExport = new Map<string, BooksDbStatistic[]>();

        for (let index = 0; index < statisticsData.length; index += 1) {
          const {
            title,
            dateKey,
            charactersRead,
            readingTime,
            minReadingSpeed,
            altMinReadingSpeed,
            lastReadingSpeed,
            maxReadingSpeed,
            lastStatisticModified,
            completedBook,
            completedData
          } = statisticsData[index];

          if (
            exportAllData ||
            (statisticsTitleFilters.get(title) &&
              dateKey >= $lastStatisticsStartDate$ &&
              dateKey <= $lastStatisticsEndDate$)
          ) {
            const entries = statisticsDataToExport.get(title) || [];

            entries.push({
              title,
              dateKey,
              charactersRead,
              readingTime,
              minReadingSpeed,
              altMinReadingSpeed,
              lastReadingSpeed,
              maxReadingSpeed,
              lastStatisticModified,
              completedBook,
              completedData
            });

            statisticsDataToExport.set(title, entries);
          }
        }

        const entriesToExport = [...statisticsDataToExport.entries()];
        const backupHandler = getStorageHandler(window, StorageKey.BACKUP);
        const exportLimiter = pLimit(1);
        const exportTasks: Promise<void>[] = [];

        backupHandler.clearData();

        entriesToExport.forEach(([titleToExport, dataToExport]) =>
          exportTasks.push(
            exportLimiter(async () => {
              try {
                const lastStatisticsModified = await database.getLastModifiedForType(
                  titleToExport,
                  StorageDataType.STATISTICS
                );

                if (dataToExport.length) {
                  backupHandler.startContext({ id: 0, title: titleToExport, imagePath: '' });

                  await backupHandler.saveStatistics(dataToExport, lastStatisticsModified);
                }
              } catch (error) {
                exportLimiter.clearQueue();

                throw error;
              }
            })
          )
        );

        if (entriesToExport.length) {
          exportTasks.push(
            exportLimiter(async () => backupHandler.createExportZip(document, false))
          );
        }

        await Promise.all(exportTasks).finally(() => backupHandler.clearData());
      } catch ({ message }: any) {
        logger.error(`Failed to Export Data: ${message}`);
      } finally {
        $statisticsSettingsActionInProgress$ = false;
      }
    }),
    reduceToEmptyString()
  );

  let isLoading = true;
  let today = getStartHoursDate($startDayHoursForTracker$);
  let todayKey = getDateString(today);
  let statisticsTitleFilters = new Map<string, boolean>();
  let titlesInStatisticsDateRange = new Set<string>();
  let statisticsData: BookStatistic[] = [];
  let statisticsForSelection: BookStatistic[] = [];
  let aggregratedStatistics: BookStatistic[] = [];
  let readingGoals: BooksDbReadingGoal[] = [];

  $: statisticsDateRangeLabel = getDateRangeLabel(
    $lastStatisticsStartDate$,
    $lastStatisticsEndDate$
  );

  $: if (
    statisticsData &&
    $lastPrimaryReadingDataAggregationMode$ &&
    $lastStatisticsStartDate$ &&
    $lastStatisticsEndDate$
  ) {
    today = getStartHoursDate($startDayHoursForTracker$);
    todayKey = getDateString(today);

    updateStatisticsData();
  }

  onMount(init);

  function onKeyUp(ev: KeyboardEvent) {
    if ($skipKeyDownListener$) {
      return;
    }

    const result = onKeyUpStatisticsTab(
      ev,
      statisticsTabKeybindMap$.getValue(),
      toggleStatisticsRangeTemplate,
      toggleStatisticsDataAggregationMode
    );

    if (!result) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    ev.preventDefault();
  }

  function updateTitleFilter({
    detail: newStatisticsTitleFilters
  }: CustomEvent<StatisticsTitleFilterItem[]>) {
    const newStatisticsTitleFilterData = new Map<string, boolean>();

    for (let index = 0, { length } = newStatisticsTitleFilters; index < length; index += 1) {
      const newStatisticsTitleFilter = newStatisticsTitleFilters[index];

      newStatisticsTitleFilterData.set(
        newStatisticsTitleFilter.title,
        newStatisticsTitleFilter.isSelected
      );
    }

    statisticsTitleFilters = newStatisticsTitleFilterData;

    updateStatisticsData();
  }

  function clearPrefilter() {
    const newStatisticsTitleFilterData = new Map<string, boolean>();

    for (let index = 0, { length } = statisticsData; index < length; index += 1) {
      const statistic = statisticsData[index];

      if (statistic.readingTime) {
        newStatisticsTitleFilterData.set(statistic.title, true);
      }
    }

    statisticsTitleFilters = newStatisticsTitleFilterData;
    $preFilteredTitlesForStatistics$ = new Set();

    updateStatisticsData();
  }

  function toggleStatisticsRangeTemplate() {
    let nextIndex =
      statisticsRangeTemplates.findIndex(
        (statisticsRangeTemplate) => $lastStatisticsRangeTemplate$ === statisticsRangeTemplate
      ) + 1;

    if (nextIndex >= statisticsRangeTemplates.length - 1) {
      nextIndex = 0;
    }

    $lastStatisticsRangeTemplate$ = statisticsRangeTemplates[nextIndex];
  }

  function toggleStatisticsDataAggregationMode() {
    let nextIndex =
      statisticsDataAggregrationModes.findIndex(
        (mode) => $lastPrimaryReadingDataAggregationMode$ === mode
      ) + 1;

    if (nextIndex > statisticsDataAggregrationModes.length - 1) {
      nextIndex = 0;
    }

    $lastPrimaryReadingDataAggregationMode$ = statisticsDataAggregrationModes[nextIndex];
  }

  async function init() {
    try {
      const db = await database.db;
      const hasPrefilteredTitlesForStatistics = !!$preFilteredTitlesForStatistics$.size;

      [statisticsData, readingGoals] = await Promise.all([
        db.getAllFromIndex('statistic', 'dateKey'),
        database.getReadingGoals()
      ]).then(([statistics, readingGoalData]) => [
        statistics.map((statistic) => {
          if (
            statistic.readingTime &&
            (!hasPrefilteredTitlesForStatistics ||
              $preFilteredTitlesForStatistics$.has(statistic.title))
          ) {
            statisticsTitleFilters.set(statistic.title, true);
          }

          return {
            ...statistic,
            ...{
              id: `${statistic.title}_${statistic.dateKey}`,
              averageReadingTime: statistic.readingTime,
              averageWeightedReadingTime: statistic.readingTime,
              averageCharactersRead: statistic.charactersRead,
              averageWeightedCharactersRead: statistic.charactersRead,
              averageReadingSpeed: statistic.lastReadingSpeed,
              averageWeightedReadingSpeed: statistic.lastReadingSpeed
            }
          };
        }),
        readingGoalData
      ]);
    } catch ({ message }: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: `Error getting Data: ${message}`
          }
        }
      ]);
    } finally {
      isLoading = false;
      $statisticsTitleFilterEnabled$ = true;
    }
  }

  function updateStatisticsData() {
    const newTitleFilterForStatisticsSet = new Set<string>();

    statisticsForSelection = statisticsData.filter((statistic) =>
      filterStatisticsForSelection(statistic, newTitleFilterForStatisticsSet)
    );
    titlesInStatisticsDateRange = newTitleFilterForStatisticsSet;

    aggregratedStatistics = [...getAggregatedStatistics($lastPrimaryReadingDataAggregationMode$)];
  }

  function getAggregatedStatistics(
    statisticsDataAggegrationMode: StatisticsReadingDataAggregationMode
  ) {
    let aggregatedStatisticsData: BookStatistic[] = [];

    if (statisticsDataAggegrationMode === StatisticsReadingDataAggregationMode.NONE) {
      aggregatedStatisticsData = statisticsForSelection;
    } else {
      const aggregationKey =
        statisticsDataAggegrationMode === StatisticsReadingDataAggregationMode.DATE
          ? 'dateKey'
          : 'title';
      const aggregrationMap = new Map<string, BookStatistic[]>();

      for (let index = 0, { length } = statisticsForSelection; index < length; index += 1) {
        const entry = statisticsForSelection[index];
        const keyValue = entry[aggregationKey];
        const entries = aggregrationMap.get(keyValue) || [];

        entries.push(entry);
        aggregrationMap.set(keyValue, entries);
      }

      const aggregationKeys = [...aggregrationMap.keys()];

      for (let index = 0, { length } = aggregationKeys; index < length; index += 1) {
        const key = aggregationKeys[index];
        const entries = aggregrationMap.get(key) || [];
        const statistic: BookStatistic = {
          ...getDefaultStatistic('-', '-'),
          ...{
            id: `${key}`,
            averageReadingTime: 0,
            averageWeightedReadingTime: 0,
            averageCharactersRead: 0,
            averageWeightedCharactersRead: 0,
            averageReadingSpeed: 0,
            averageWeightedReadingSpeed: 0
          }
        };

        let weightedSum = 0;
        let validReadingDays = 0;

        for (let index2 = 0, { length: length2 } = entries; index2 < length2; index2 += 1) {
          const entry = entries[index2];

          if (aggregationKey === 'title') {
            statistic.title = key;
          } else {
            statistic.dateKey = key;
          }

          statistic.readingTime += entry.readingTime;
          statistic.charactersRead += entry.charactersRead;
          statistic.minReadingSpeed = statistic.minReadingSpeed
            ? Math.min(statistic.minReadingSpeed, entry.minReadingSpeed)
            : entry.minReadingSpeed;
          statistic.altMinReadingSpeed = statistic.altMinReadingSpeed
            ? Math.min(statistic.altMinReadingSpeed, entry.altMinReadingSpeed)
            : statistic.altMinReadingSpeed;
          statistic.maxReadingSpeed = Math.max(statistic.maxReadingSpeed, entry.lastReadingSpeed);
          weightedSum += entry.readingTime * entry.charactersRead;

          if (statistic.readingTime) {
            validReadingDays += 1;
          }
        }

        statistic.lastReadingSpeed = statistic.readingTime
          ? Math.ceil((3600 * statistic.charactersRead) / statistic.readingTime)
          : 0;
        statistic.averageReadingTime = validReadingDays
          ? Math.ceil(statistic.readingTime / validReadingDays)
          : 0;
        statistic.averageWeightedReadingTime = statistic.charactersRead
          ? Math.ceil(weightedSum / statistic.charactersRead)
          : 0;
        statistic.averageCharactersRead = validReadingDays
          ? Math.ceil(statistic.charactersRead / validReadingDays)
          : 0;
        statistic.averageWeightedCharactersRead = statistic.readingTime
          ? Math.ceil(weightedSum / statistic.readingTime)
          : 0;
        statistic.averageReadingSpeed = statistic.averageReadingTime
          ? Math.ceil((3600 * statistic.averageCharactersRead) / statistic.averageReadingTime)
          : 0;
        statistic.averageWeightedReadingSpeed = statistic.averageWeightedReadingTime
          ? Math.ceil(
              (3600 * statistic.averageWeightedCharactersRead) /
                statistic.averageWeightedReadingTime
            )
          : 0;

        aggregatedStatisticsData.push(statistic);
      }
    }

    return aggregatedStatisticsData;
  }

  function filterStatisticsForSelection(
    statistic: BookStatistic,
    newTitleFilterForStatisticsSet: Set<string>
  ) {
    const isInDateRange =
      statistic.readingTime &&
      statistic.dateKey >= $lastStatisticsStartDate$ &&
      statistic.dateKey <= $lastStatisticsEndDate$;

    if (isInDateRange) {
      newTitleFilterForStatisticsSet.add(statistic.title);
    }

    return isInDateRange && statisticsTitleFilters.get(statistic.title);
  }
</script>

{$copyStatisticsDataHandler$ ?? ''}
{$exportStatisticsDataHandler$ ?? ''}
<svelte:window on:keyup={onKeyUp} />
{#if isLoading}
  <div class="flex fixed items-center justify-center inset-0 h-full w-full text-7xl">
    <Fa icon={faSpinner} spin />
  </div>
{:else}
  {#if $lastStatisticsTab$ === StatisticsTab.OVERVIEW}
    <StatisticsHeatmap
      {statisticsData}
      {readingGoals}
      {statisticsTitleFilters}
      {today}
      {todayKey}
      bind:heatmapAggregration={$lastReadingDataHeatmapAggregationMode$}
    />
    {#if readingGoals.length}
      <div class="mt-8 sm:mt-16">
        <StatisticsHeatmap
          {statisticsData}
          {readingGoals}
          {statisticsTitleFilters}
          {today}
          {todayKey}
          heatmapType={HeatmapType.READING_GOALS}
          bind:heatmapAggregration={$lastReadingGoalsHeatmapAggregationMode$}
        />
      </div>
    {/if}
  {/if}
  {#if $lastStatisticsTab$ === StatisticsTab.SUMMARY}
    <StatisticsSummary {aggregratedStatistics} {statisticsDateRangeLabel} />
  {/if}
{/if}
{#if $statisticsTitleFilterIsOpen$}
  <div
    class="writing-horizontal-tb fixed top-0 right-0 z-[60] flex h-full w-full max-w-xl flex-col justify-between bg-gray-700 text-white"
    in:fly|local={{ x: 100, duration: 100, easing: quintInOut }}
    use:clickOutside={() => ($statisticsTitleFilterIsOpen$ = false)}
  >
    <StatisticsTitleFilter
      {statisticsTitleFilters}
      {titlesInStatisticsDateRange}
      on:applyFilter={updateTitleFilter}
      on:clearPrefilter={clearPrefilter}
      on:close={() => ($statisticsTitleFilterIsOpen$ = false)}
    />
  </div>
{/if}
