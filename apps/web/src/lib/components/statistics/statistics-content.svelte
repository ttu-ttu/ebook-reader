<script lang="ts">
  import { onKeyUpStatisticsTab } from '../../../routes/b/on-keydown-reader';
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import { getDefaultStatistic } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import { HeatmapType } from '$lib/components/statistics/statistics-heatmap/statistics-heatmap';
  import StatisticsHeatmap from '$lib/components/statistics/statistics-heatmap/statistics-heatmap.svelte';
  import StatisticsSummary from '$lib/components/statistics/statistics-summary/statistics-summary.svelte';
  import type {
    StatisticsDeleteRequest,
    StatisticsEditRequest
  } from '$lib/components/statistics/statistics-summary/statistics-summary';
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
    statisticsActionInProgress$,
    deleteStatisticsData$,
    setStatisticsDatesToAllTime$,
    StatisticsRangeTemplate
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
    confirmStatisticsDeletion$,
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
  import { pluralize } from '$lib/functions/utils';
  import pLimit from 'p-limit';
  import { tap } from 'rxjs';
  import { onDestroy, onMount, tick } from 'svelte';
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
        $statisticsActionInProgress$ = false;
      }
    }),
    reduceToEmptyString()
  );

  const deleteStatisticsDataHandler$ = deleteStatisticsData$.pipe(
    tap(async (deleteAllData) => {
      const dataList = deleteAllData ? statisticsData : statisticsForSelection;
      const request: StatisticsDeleteRequest = {
        startDate: deleteAllData ? '' : $lastStatisticsStartDate$,
        endDate: deleteAllData ? '' : $lastStatisticsEndDate$,
        titlesToCheck: new Set<string>(),
        takeAsIs: true
      };

      for (let index = 0, { length } = dataList; index < length; index += 1) {
        request.titlesToCheck.add(dataList[index].title);
      }

      handleDeleteRequest(
        new CustomEvent<StatisticsDeleteRequest>('delete', { detail: request })
      ).finally(() => {
        tick().then(() => dialogManager.dialogs$.next([{ component: '<div/>' }]));
      });
    }),
    reduceToEmptyString()
  );

  const setStatisticsDatesToAllTimeHandler$ = setStatisticsDatesToAllTime$.pipe(
    tap(() => {
      if (!statisticsTitleFilters.size) {
        return;
      }

      let startDate = '';

      for (let index = 0, { length } = statisticsData; index < length; index += 1) {
        const statistic = statisticsData[index];

        if (statisticsTitleFilters.get(statistic.title)) {
          startDate = statistic.dateKey;
          break;
        }
      }

      if (!startDate) {
        return;
      }

      for (let index = statisticsData.length - 1; index >= 0; index -= 1) {
        const statistic = statisticsData[index];

        if (statisticsTitleFilters.get(statistic.title)) {
          $lastStatisticsStartDate$ = startDate;
          $lastStatisticsEndDate$ = statistic.dateKey;
          $lastStatisticsRangeTemplate$ = StatisticsRangeTemplate.CUSTOM;
          break;
        }
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

  onDestroy(() => dialogManager.dialogs$.next([]));

  function onKeyUp(ev: KeyboardEvent) {
    if (
      $skipKeyDownListener$ ||
      ev.altKey ||
      ev.ctrlKey ||
      ev.shiftKey ||
      ev.metaKey ||
      ev.repeat
    ) {
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

  async function handleDeleteRequest({
    detail: { startDate, endDate, titlesToCheck, takeAsIs }
  }: CustomEvent<StatisticsDeleteRequest>) {
    let titlesToDelete = new Set<string>();

    $statisticsActionInProgress$ = true;

    if (takeAsIs) {
      titlesToDelete = titlesToCheck;
    } else {
      for (let index = 0, { length } = statisticsForSelection; index < length; index += 1) {
        const statistic = statisticsForSelection[index];

        if (
          statistic.dateKey >= startDate &&
          statistic.dateKey <= endDate &&
          (!titlesToCheck.size || titlesToCheck.has(statistic.title))
        ) {
          titlesToDelete.add(statistic.title);
        }
      }
    }

    if (!titlesToDelete.size) {
      $statisticsActionInProgress$ = false;
      return;
    }

    const titleLabel = pluralize(titlesToDelete.size, 'Title');

    let wasCanceled = false;

    if ($confirmStatisticsDeletion$) {
      wasCanceled = await new Promise((resolver) => {
        dialogManager.dialogs$.next([
          {
            component: ConfirmDialog,
            props: {
              dialogHeader: 'Delete Data',
              dialogMessage: `This will delete data ${
                startDate ? `from ${getDateRangeLabel(startDate, endDate)}` : ''
              }  for ${titleLabel} (which may include start and/or completion Data)\n\nExecute an one time Sync with an export behavior of "overwrite" and/or statistics merge mode of "replace" to apply deletions to other devices.\n\n${titleLabel}:\n${[
                ...titlesToDelete
              ].join('\n\n')}`,
              contentStyles: 'white-space: pre-line;max-height: 20rem;overflow: auto;',
              resolver
            },
            disableCloseOnClick: true,
            zIndex: '70'
          }
        ]);
      });
    }

    if (wasCanceled) {
      $statisticsActionInProgress$ = false;
      return;
    }

    const error = await database
      .deleteStatisticEntries([...titlesToDelete], false, startDate, endDate)
      .catch(({ message }) => message);

    if (error) {
      await new Promise((resolver) => {
        dialogManager.dialogs$.next([
          {
            component: ConfirmDialog,
            props: {
              dialogHeader: 'Delete Data',
              dialogMessage: `Failed to delete Data: ${error}`,
              showCancel: false,
              resolver
            },
            disableCloseOnClick: true,
            zIndex: '70'
          }
        ]);
      });
      $statisticsActionInProgress$ = false;
    } else {
      const filterMap = new Map<string, boolean>();
      const notDeletedMap = new Map<string, boolean>();

      statisticsData = statisticsData.filter((statistic) => {
        if (titlesToDelete.has(statistic.title)) {
          const returnValue = startDate
            ? !(statistic.dateKey >= startDate && statistic.dateKey <= endDate)
            : false;

          if (returnValue || !filterMap.get(statistic.title)) {
            filterMap.set(statistic.title, returnValue);
          }

          return returnValue;
        }

        if (statistic.readingTime) {
          notDeletedMap.set(statistic.title, statisticsTitleFilters.get(statistic.title) || false);
        }

        return true;
      });

      const preFilteredTitlesForStatistics = [...$preFilteredTitlesForStatistics$];

      for (let index = 0, { length } = preFilteredTitlesForStatistics; index < length; index += 1) {
        const preFilteredTitleForStatistics = preFilteredTitlesForStatistics[index];

        if (
          filterMap.has(preFilteredTitleForStatistics) &&
          !filterMap.get(preFilteredTitleForStatistics)
        ) {
          statisticsTitleFilters.delete(preFilteredTitleForStatistics);
          $preFilteredTitlesForStatistics$.delete(preFilteredTitleForStatistics);
        }
      }

      if ($preFilteredTitlesForStatistics$.size) {
        statisticsTitleFilters = statisticsTitleFilters;
        $preFilteredTitlesForStatistics$ = $preFilteredTitlesForStatistics$;
      } else {
        const filteredEntries = [...filterMap.entries()];
        const titleFilters = [...notDeletedMap.entries()];
        const newStatisticsTitleFilterData = new Map<string, boolean>();

        for (let index = 0, { length } = filteredEntries; index < length; index += 1) {
          const [title, hasData] = filteredEntries[index];

          if (hasData) {
            newStatisticsTitleFilterData.set(title, true);
          }
        }

        for (let index = 0, { length } = titleFilters; index < length; index += 1) {
          const [title, isDisplayed] = titleFilters[index];

          newStatisticsTitleFilterData.set(title, isDisplayed);
        }

        statisticsTitleFilters = newStatisticsTitleFilterData;
      }

      updateStatisticsData();
      $statisticsActionInProgress$ = false;
    }
  }

  async function handleEditRequest({
    detail: { dateKey, title, newReadingTime, newCharactersRead, resetMinMaxValues }
  }: CustomEvent<StatisticsEditRequest>) {
    $statisticsActionInProgress$ = true;

    const statisticIndex = statisticsData.findIndex(
      (statistic) => statistic.dateKey === dateKey && statistic.title === title
    );
    const statistic = statisticsData[statisticIndex];
    const newStatistic: BookStatistic = {
      ...statistic,
      readingTime: newReadingTime,
      averageReadingTime: newReadingTime,
      averageWeightedReadingTime: newReadingTime,
      charactersRead: newCharactersRead,
      averageCharactersRead: newCharactersRead,
      averageWeightedCharactersRead: newCharactersRead,
      lastReadingSpeed: newReadingTime ? Math.ceil((3600 * newCharactersRead) / newReadingTime) : 0,
      lastStatisticModified: Date.now()
    };

    newStatistic.averageReadingSpeed = newStatistic.lastReadingSpeed;
    newStatistic.averageWeightedReadingSpeed = newStatistic.lastReadingSpeed;
    newStatistic.minReadingSpeed =
      newStatistic.minReadingSpeed && !resetMinMaxValues
        ? Math.min(newStatistic.minReadingSpeed, newStatistic.lastReadingSpeed)
        : newStatistic.lastReadingSpeed;
    newStatistic.maxReadingSpeed = resetMinMaxValues
      ? newStatistic.lastReadingSpeed
      : Math.max(newStatistic.maxReadingSpeed, newStatistic.lastReadingSpeed);

    if (newCharactersRead || resetMinMaxValues) {
      newStatistic.altMinReadingSpeed =
        newStatistic.altMinReadingSpeed && !resetMinMaxValues
          ? Math.min(newStatistic.altMinReadingSpeed, newStatistic.lastReadingSpeed)
          : newStatistic.lastReadingSpeed;
    }

    const wasCanceled = await new Promise((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: ConfirmDialog,
          props: {
            dialogHeader: 'Update Data',
            dialogMessage: `This will update the Data for ${title} on ${dateKey}.\n\nTime: ${secondsToMinutes(
              statistic.readingTime
            )} min => ${secondsToMinutes(newReadingTime)} min\nCharacters: ${
              statistic.charactersRead
            } => ${newCharactersRead}\nSpeed: ${statistic.lastReadingSpeed} / h => ${
              newStatistic.lastReadingSpeed
            } / h\nMin Speed: ${statistic.minReadingSpeed} / h => ${
              newStatistic.minReadingSpeed
            } / h\nAlt Min Speed: ${statistic.altMinReadingSpeed} / h => ${
              newStatistic.altMinReadingSpeed
            } / h\nMax Speed: ${statistic.maxReadingSpeed} / h => ${
              newStatistic.maxReadingSpeed
            } / h`,
            contentStyles: 'white-space: pre-line;max-height: 20rem;overflow: auto;',
            resolver
          },
          disableCloseOnClick: true,
          zIndex: '70'
        }
      ]);
    });

    if (wasCanceled) {
      $statisticsActionInProgress$ = false;
      return;
    }

    try {
      await database.updateStatistic(newStatistic);

      statisticsData[statisticIndex] = { ...statistic, ...newStatistic };
      updateStatisticsData();
    } catch ({ message }: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: `Update failed: ${message}`
          }
        }
      ]);
    } finally {
      $statisticsActionInProgress$ = false;
    }
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
{$deleteStatisticsDataHandler$ ?? ''}
{$setStatisticsDatesToAllTimeHandler$ ?? ''}
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
    <StatisticsSummary
      {aggregratedStatistics}
      {statisticsDateRangeLabel}
      on:delete={handleDeleteRequest}
      on:edit={handleEditRequest}
    />
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
{#if $statisticsActionInProgress$}
  <div class="tap-highlight-transparent fixed inset-0 bg-black/[.2] z-[70]" />
  <div class="flex fixed items-center justify-center inset-0 h-full w-full text-7xl">
    <Fa icon={faSpinner} spin />
  </div>
{/if}
