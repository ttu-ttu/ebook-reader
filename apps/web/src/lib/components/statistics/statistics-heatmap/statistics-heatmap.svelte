<script lang="ts">
  import {
    faChevronLeft,
    faChevronRight,
    faClose,
    faLayerGroup,
    faRepeat
  } from '@fortawesome/free-solid-svg-icons';
  import { ReadingGoalFrequency } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    type HeatmapMonthLabel,
    type HeatmapStreak,
    type StatisticsHeatmapData,
    monthLabelList,
    heatmapGridGapValue,
    heatmapDayMargins,
    heatmapDayElementSize,
    HeatmapStreakType,
    HeatmapDataAggregration,
    type HeatmapGlobalDayData,
    type ReadingGoalsHeatmapData,
    type HeatmapColorRange,
    HeatmapType,
    type ReadingGoalHeatmapGlobalDayData,
    daysOfWeekShort,
    heatmapMinValueColor,
    heatmapMaxValueColor,
    type StatisticsHeatmapDayData
  } from '$lib/components/statistics/statistics-heatmap/statistics-heatmap';
  import type {
    BooksDbReadingGoal,
    BooksDbStatistic
  } from '$lib/data/database/books-db/versions/books-db';
  import { getDateRangeLabel } from '$lib/data/reading-goal';
  import {
    lastStartDayOfWeek$,
    lastStatisticsEndDate$,
    lastStatisticsStartDate$
  } from '$lib/data/store';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import {
    advanceDateDays,
    getDate,
    getDateString,
    getDaysBetween,
    getPreviousDayKey,
    secondsToMinutes
  } from '$lib/functions/statistic-util';
  import { caluclatePercentage, dummyFn, limitToRange, pluralize } from '$lib/functions/utils';
  import { debounceTime, fromEvent, tap } from 'rxjs';
  import { onMount, tick } from 'svelte';
  import Fa from 'svelte-fa';

  export let heatmapType: HeatmapType = HeatmapType.STATISTICS;
  export let heatmapAggregration: HeatmapDataAggregration;
  export let statisticsData: BooksDbStatistic[];
  export let readingGoals: BooksDbReadingGoal[];
  export let statisticsTitleFilters: Map<string, boolean>;
  export let today: Date;
  export let todayKey: string;

  const resizeHandler$ = fromEvent(window, 'resize').pipe(
    debounceTime(250),
    tap(updateHeatmapDimensions),
    reduceToEmptyString()
  );

  const colorRanges: HeatmapColorRange[] = [];

  let heatmapElement: HTMLElement;
  let heatmapDetailDataPopover: Popover;
  let monthLabels: HeatmapMonthLabel[] = [...monthLabelList];
  let dayElementSize = heatmapDayElementSize;
  let heatmapYear = today.getFullYear();
  let globalHeatmapData: StatisticsHeatmapData | ReadingGoalsHeatmapData;
  const globalHeatmapDayData = new Map<
    string,
    HeatmapGlobalDayData | ReadingGoalHeatmapGlobalDayData
  >();
  const heatmapDataByYear = new Map<number, StatisticsHeatmapData | ReadingGoalsHeatmapData>();
  let currentHeatmapData: StatisticsHeatmapData | ReadingGoalsHeatmapData;
  let currentHeatmapDays: StatisticsHeatmapDayData[] = [];
  let popoverDetails: string[] = [];
  let selectedStreak = HeatmapStreakType.NONE;
  let selectedStreakDates = new Set<string>();

  $: heatmapLabel = `Reading ${
    heatmapType === HeatmapType.STATISTICS ? '' : 'Goals '
  }Data for ${heatmapYear}`;

  $: dayLabels = [
    ...daysOfWeekShort.slice($lastStartDayOfWeek$),
    ...($lastStartDayOfWeek$ ? daysOfWeekShort.slice(0, $lastStartDayOfWeek$) : [])
  ];

  $: if ($lastStartDayOfWeek$ > -1 || heatmapAggregration) {
    tick().then(() => {
      updateHeatmapData(heatmapYear);
    });
  }

  $: if (statisticsTitleFilters) {
    selectedStreak = HeatmapStreakType.NONE;
    selectedStreakDates = new Set();

    updateHeatmapDataAfterFilterChange();
  }

  $: if (heatmapAggregration) {
    selectedStreak = HeatmapStreakType.NONE;
    selectedStreakDates = new Set();
  }

  onMount(() => {
    if (heatmapType === HeatmapType.READING_GOALS) {
      colorRanges.push(
        {
          limit: 100,
          color: `#${heatmapMaxValueColor}`
        },
        ...getColorRanges(1, 100, 100)
      );
    }

    updateHeatmapDimensions();
  });

  function checkIsStatisticsHeatmapData(
    heatmapData: StatisticsHeatmapData | ReadingGoalsHeatmapData
  ): heatmapData is StatisticsHeatmapData {
    return 'daysRead' in heatmapData;
  }

  function changeHeatmapYear(modifier: number) {
    if (!modifier) {
      return;
    }

    if (heatmapAggregration === HeatmapDataAggregration.YEAR) {
      selectedStreak = HeatmapStreakType.NONE;
      selectedStreakDates = new Set();
    }

    heatmapYear += modifier;

    tick().then(() => {
      heatmapElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }

  async function highlightStreaks(streaks: HeatmapStreak[], streakToSelect: HeatmapStreakType) {
    if (!streaks.length) {
      return;
    }

    let heatmapStreak;
    let heatmapYearModifier = 0;

    if (heatmapAggregration === HeatmapDataAggregration.ALL_TIME) {
      const firstDayOfYearDateString = getDateString(new Date(heatmapYear, 0, 1, 0, 0, 0, 0));
      const lastDayOfYearDateString = getDateString(new Date(heatmapYear, 11, 31, 0, 0, 0, 0));

      heatmapStreak =
        streaks.find(
          (streak) =>
            (streak.startDate >= firstDayOfYearDateString &&
              streak.startDate <= lastDayOfYearDateString) ||
            (firstDayOfYearDateString >= streak.startDate &&
              firstDayOfYearDateString <= streak.endDate)
        ) || streaks[0];
    }

    if (heatmapStreak) {
      const streakYear = getDate(heatmapStreak.startDate).getFullYear();

      heatmapYearModifier = streakYear - heatmapYear;
    }

    if (heatmapYearModifier) {
      changeHeatmapYear(heatmapYearModifier);
      await tick();
      await new Promise((resolve) => {
        setTimeout(resolve);
      });
    }

    if (heatmapYearModifier && selectedStreak === streakToSelect) {
      return;
    }

    selectedStreak = selectedStreak === streakToSelect ? HeatmapStreakType.NONE : streakToSelect;
    selectedStreakDates = new Set<string>();

    if (selectedStreak !== HeatmapStreakType.NONE) {
      for (let index = 0, { length } = streaks; index < length; index += 1) {
        const streak = streaks[index];
        const streakDate = getDate(streak.startDate);

        let streakDateString = streak.startDate;

        while (streakDateString <= streak.endDate) {
          selectedStreakDates.add(streakDateString);

          ({ dateString: streakDateString } = advanceDateDays(streakDate));
        }
      }

      scrollToDay(heatmapStreak?.startDate || streaks[0].startDate);
    }
  }

  function scrollToDay(referenceDateString: string) {
    if (!heatmapElement || !referenceDateString) {
      return;
    }

    const dayElement = heatmapElement.querySelector(
      `div[data-date="${referenceDateString}"]`
    ) as HTMLElement | null;

    if (dayElement) {
      const absoluteElementLeft = dayElement.offsetLeft + dayElement.clientWidth / 2;
      const middle = absoluteElementLeft - heatmapElement.clientWidth / 2;

      heatmapElement.scrollTo(middle, 0);
    }
  }

  function updateHeatmapDimensions() {
    if (!heatmapElement?.parentElement) {
      return;
    }

    const containerWidth = heatmapElement.parentElement.clientWidth;
    const arrowElementsWidth = 30;
    const gridGap = heatmapGridGapValue * 2;
    const gridColumnsPerYear = 54;
    const gridColumnsWidth = gridColumnsPerYear * gridGap;
    const dayGridColums = 3;
    const allGridColumns = gridColumnsPerYear + dayGridColums;

    dayElementSize = Math.max(
      dayElementSize,
      Math.ceil((containerWidth - arrowElementsWidth - gridColumnsWidth) / allGridColumns)
    );
  }

  function updateHeatmapDataAfterFilterChange() {
    globalHeatmapDayData.clear();
    heatmapDataByYear.clear();

    updateHeatmapData(heatmapYear);
  }

  function updateHeatmapData(newYear: number) {
    if (heatmapType === HeatmapType.STATISTICS) {
      updateHeatmapDataForStatistics(newYear);
    } else {
      updateHeatmapDataForReadingGoals(newYear);
    }
  }

  function updateHeatmapDataForStatistics(newYear: number) {
    const daysRead = new Set<string>();
    let maxReadingTime = 0;
    let minReadingTime = 0;
    let firstReadingDay;
    let lastReadingDay;

    heatmapYear = newYear;

    if (!globalHeatmapDayData.size) {
      const streaks: HeatmapStreak[] = [];

      let currentReadingStreakDate = new Date();
      let currentReadingStreakDateString = '';
      let currentReadingStreak: HeatmapStreak = { startDate: '', endDate: '', duration: 0 };

      for (let index = 0, { length } = statisticsData; index < length; index += 1) {
        const entry = statisticsData[index];

        if (statisticsTitleFilters.get(entry.title)) {
          const { dateKey } = entry;
          const entryData = globalHeatmapDayData.get(dateKey) || getDefaultHeatmapGlobalDayData();

          entryData.readingTime += entry.readingTime;
          entryData.charactersRead += entry.charactersRead;

          if (entry.readingTime) {
            const entryDate = getDate(dateKey);

            if (!firstReadingDay) {
              firstReadingDay = entryDate;
            }

            lastReadingDay = entryDate;

            if (currentReadingStreakDateString === dateKey) {
              currentReadingStreak.duration += 1;
              ({ dateString: currentReadingStreakDateString } =
                advanceDateDays(currentReadingStreakDate));
            } else if (currentReadingStreak.startDate && !daysRead.has(dateKey)) {
              currentReadingStreak.endDate = getPreviousDayKey(0, currentReadingStreakDate, true);
              currentReadingStreak.duration += 1;

              streaks.push(currentReadingStreak);

              currentReadingStreak = { startDate: '', endDate: '', duration: 0 };
            }

            if (!currentReadingStreak.startDate) {
              currentReadingStreak.startDate = dateKey;

              ({
                referenceDate: currentReadingStreakDate,
                dateString: currentReadingStreakDateString
              } = advanceDateDays(getDate(dateKey)));
            }

            entryData.titles.add(entry.title);

            maxReadingTime = Math.max(maxReadingTime, entryData.readingTime);
            minReadingTime = minReadingTime
              ? Math.min(minReadingTime, entryData.readingTime)
              : entryData.readingTime;

            daysRead.add(dateKey);
          }

          globalHeatmapDayData.set(dateKey, entryData);
        }
      }

      if (currentReadingStreak.startDate) {
        const { dateString: streakEnd } = advanceDateDays(
          getDate(currentReadingStreak.startDate),
          currentReadingStreak.duration
        );

        currentReadingStreak.duration += 1;
        currentReadingStreak.endDate = streakEnd;

        streaks.push(currentReadingStreak);
      }

      streaks.sort(sortStreaks);

      globalHeatmapData = {
        streaks,
        daysRead: getDaysReadLabel(getDaysBetween(firstReadingDay, lastReadingDay), daysRead),
        colorRanges: getColorRanges(minReadingTime, maxReadingTime),
        longestStreaks: getLongestStreaks(streaks),
        currentStreak: getCurrentStreak(streaks, todayKey)
      };
    }

    if (heatmapAggregration === HeatmapDataAggregration.ALL_TIME) {
      currentHeatmapData = globalHeatmapData;
    } else if (heatmapDataByYear.has(heatmapYear)) {
      currentHeatmapData = heatmapDataByYear.get(heatmapYear)!;
    } else {
      const firstDayOfYearDateString = getDateString(new Date(heatmapYear, 0, 1, 0, 0, 0, 0));
      const lastDayOfYearDateString = getDateString(new Date(heatmapYear, 11, 31, 0, 0, 0, 0));
      const dayKeys = [...globalHeatmapDayData.keys()];
      const streaksInYear: HeatmapStreak[] = JSON.parse(
        JSON.stringify(
          globalHeatmapData.streaks.filter(
            (streak) =>
              (streak.startDate >= firstDayOfYearDateString &&
                streak.startDate <= lastDayOfYearDateString) ||
              (firstDayOfYearDateString >= streak.startDate &&
                firstDayOfYearDateString <= streak.endDate)
          )
        )
      ).map((streak: HeatmapStreak) => {
        const streakObject = streak;
        const adjustStartDate = streakObject.startDate < firstDayOfYearDateString;
        const adjustEndDate = streakObject.endDate > lastDayOfYearDateString;

        streakObject.startDate = adjustStartDate
          ? firstDayOfYearDateString
          : streakObject.startDate;
        streakObject.endDate = adjustEndDate ? lastDayOfYearDateString : streakObject.endDate;

        if (adjustStartDate || adjustEndDate) {
          streakObject.duration = getDaysBetween(
            getDate(streakObject.startDate),
            getDate(streakObject.endDate)
          );
        }

        return { ...streakObject };
      });

      streaksInYear.sort(sortStreaks);

      firstReadingDay = undefined;
      lastReadingDay = undefined;
      minReadingTime = 0;
      maxReadingTime = 0;
      daysRead.clear();

      for (let index = 0, { length } = dayKeys; index < length; index += 1) {
        const dayKey = dayKeys[index];

        if (dayKey > lastDayOfYearDateString) {
          break;
        }

        if (dayKey >= firstDayOfYearDateString) {
          const dayData = globalHeatmapDayData.get(dayKey)!;

          if (dayData.readingTime) {
            const entryDate = getDate(dayKey);

            if (!firstReadingDay) {
              firstReadingDay = entryDate;
            }

            daysRead.add(dayKey);

            lastReadingDay = entryDate;
            maxReadingTime = Math.max(maxReadingTime, dayData.readingTime);
            minReadingTime = minReadingTime
              ? Math.min(minReadingTime, dayData.readingTime)
              : dayData.readingTime;
          }
        }
      }

      const heatmapDataForYear: StatisticsHeatmapData = {
        streaks: streaksInYear,
        daysRead: getDaysReadLabel(getDaysBetween(firstReadingDay, lastReadingDay), daysRead),
        colorRanges: getColorRanges(minReadingTime, maxReadingTime),
        longestStreaks: getLongestStreaks(streaksInYear),
        currentStreak: getCurrentStreak(streaksInYear, todayKey)
      };

      heatmapDataByYear.set(heatmapYear, heatmapDataForYear);
      currentHeatmapData = heatmapDataForYear;
    }

    updateHeatmapDayData(undefined);
  }

  function updateHeatmapDataForReadingGoals(newYear: number) {
    const globalDataObject = globalHeatmapDayData as Map<string, ReadingGoalHeatmapGlobalDayData>;

    let completedReadingGoalsCount = 0;
    let closedReadingGoalsCount = 0;

    heatmapYear = newYear;

    if (!globalDataObject.size) {
      const groupsedStatisticsData = new Map<string, HeatmapGlobalDayData>();
      const streaks: HeatmapStreak[] = [];

      let lastDayString = todayKey;
      let currentReadingGoalsStreak: HeatmapStreak = {
        startDate: '',
        endDate: '',
        duration: 0
      };

      for (let index = 0, { length } = statisticsData; index < length; index += 1) {
        const entry = statisticsData[index];

        if (statisticsTitleFilters.get(entry.title)) {
          const entryData =
            groupsedStatisticsData.get(entry.dateKey) || getDefaultHeatmapGlobalDayData();

          entryData.readingTime += entry.readingTime;
          entryData.charactersRead += entry.charactersRead;

          if (entryData.readingTime) {
            entryData.titles.add(entry.title);
          }

          groupsedStatisticsData.set(entry.dateKey, entryData);

          if (entry.dateKey > lastDayString) {
            lastDayString = entry.dateKey;
          }
        }
      }

      for (let index = 0, { length } = readingGoals; index < length; index += 1) {
        const readingGoal = readingGoals[index];

        const readingGoalDate = getDate(readingGoal.goalStartDate);

        let readingGoalDateString = readingGoal.goalStartDate;

        while (
          (readingGoal.goalEndDate && readingGoalDateString <= readingGoal.goalEndDate) ||
          (!readingGoal.goalEndDate && readingGoalDateString <= lastDayString)
        ) {
          const currentReadingGoalWindow: ReadingGoalHeatmapGlobalDayData = {
            readingGoalStartDate: readingGoalDateString,
            readingGoalEndDate: readingGoal.goalEndDate,
            timeGoal: readingGoal.timeGoal,
            readingTime: 0,
            characterGoal: readingGoal.characterGoal,
            charactersRead: 0,
            closedEarly: false,
            readingTimePercentage: 0,
            normalizedReadingTimePercentage: 0,
            charactersReadPercentage: 0,
            normalizedCharactersReadPercentage: 0,
            readingGoalCompletedPercentage: 0,
            normalizedReadingGoalCompletedPercentage: 0,
            titles: new Set<string>()
          };

          let currentReadingGoalDay = currentReadingGoalWindow.readingGoalStartDate;
          const currentReadingGoalDayDate = getDate(currentReadingGoalDay);

          switch (readingGoal.goalFrequency) {
            case ReadingGoalFrequency.WEEKLY:
              readingGoalDate.setDate(readingGoalDate.getDate() + 6);
              break;
            case ReadingGoalFrequency.MONTHLY:
              readingGoalDate.setDate(readingGoalDate.getDate() + 29);
              break;

            default:
              break;
          }

          currentReadingGoalWindow.readingGoalEndDate = getDateString(readingGoalDate);

          if (
            readingGoal.goalEndDate &&
            currentReadingGoalWindow.readingGoalEndDate > readingGoal.goalEndDate
          ) {
            currentReadingGoalWindow.readingGoalEndDate = readingGoal.goalEndDate;
          }

          currentReadingGoalWindow.closedEarly =
            currentReadingGoalWindow.readingGoalEndDate < readingGoal.goalOriginalEndDate;

          while (currentReadingGoalDay <= currentReadingGoalWindow.readingGoalEndDate) {
            const data = groupsedStatisticsData.get(currentReadingGoalDay);

            if (data) {
              currentReadingGoalWindow.readingTime += data.readingTime;
              currentReadingGoalWindow.charactersRead += data.charactersRead;
              data.titles.forEach((title) => currentReadingGoalWindow.titles.add(title));
            }

            ({ dateString: currentReadingGoalDay } = advanceDateDays(currentReadingGoalDayDate));
          }

          const allBasePercentage =
            currentReadingGoalWindow.timeGoal && currentReadingGoalWindow.characterGoal ? 2 : 1;
          const realReadingTimePercentage = currentReadingGoalWindow.timeGoal
            ? currentReadingGoalWindow.readingTime / currentReadingGoalWindow.timeGoal
            : 0;
          const realCharactersReadPercentage = currentReadingGoalWindow.characterGoal
            ? currentReadingGoalWindow.charactersRead / currentReadingGoalWindow.characterGoal
            : 0;
          const percentageSum = realReadingTimePercentage + realCharactersReadPercentage;
          const realPercentage = caluclatePercentage(percentageSum, allBasePercentage);

          currentReadingGoalWindow.readingTimePercentage = Math.floor(
            realReadingTimePercentage * 100
          );
          currentReadingGoalWindow.normalizedReadingTimePercentage = limitToRange(
            0,
            100,
            currentReadingGoalWindow.readingTimePercentage
          );
          currentReadingGoalWindow.charactersReadPercentage = Math.floor(
            realCharactersReadPercentage * 100
          );
          currentReadingGoalWindow.normalizedCharactersReadPercentage = limitToRange(
            0,
            100,
            currentReadingGoalWindow.charactersReadPercentage
          );
          currentReadingGoalWindow.readingGoalCompletedPercentage = realPercentage;
          currentReadingGoalWindow.normalizedReadingGoalCompletedPercentage = limitToRange(
            0,
            100,
            caluclatePercentage(
              limitToRange(0, 1, realReadingTimePercentage) +
                limitToRange(0, 1, realCharactersReadPercentage),
              allBasePercentage
            )
          );

          const completedReadingGoal =
            currentReadingGoalWindow.normalizedReadingGoalCompletedPercentage === 100;

          closedReadingGoalsCount += 1;

          if (completedReadingGoal) {
            completedReadingGoalsCount += 1;
            currentReadingGoalsStreak.startDate =
              currentReadingGoalsStreak.startDate || currentReadingGoalWindow.readingGoalStartDate;
            currentReadingGoalsStreak.endDate = currentReadingGoalWindow.readingGoalEndDate;
            currentReadingGoalsStreak.duration += 1;
          } else {
            if (currentReadingGoalsStreak.duration) {
              streaks.push(currentReadingGoalsStreak);
            }

            currentReadingGoalsStreak = { startDate: '', endDate: '', duration: 0 };
          }

          globalDataObject.set(
            currentReadingGoalWindow.readingGoalStartDate,
            currentReadingGoalWindow
          );

          ({ dateString: readingGoalDateString } = advanceDateDays(readingGoalDate));
        }
      }

      if (currentReadingGoalsStreak.startDate) {
        const lastStreak = streaks[streaks.length - 1];

        if (!lastStreak || lastStreak.startDate !== currentReadingGoalsStreak.startDate) {
          streaks.push(currentReadingGoalsStreak);
        }
      }

      streaks.sort(sortStreaks);

      globalHeatmapData = {
        completedReadingGoals: getCompletedReadingGoalsLabel(
          completedReadingGoalsCount,
          closedReadingGoalsCount
        ),
        streaks,
        longestStreaks: getLongestStreaks(streaks),
        currentStreak: getCurrentStreak(streaks, todayKey)
      };
    }

    const firstDayOfYearDateString = getDateString(new Date(heatmapYear, 0, 1, 0, 0, 0, 0));
    const lastDayOfYearDateString = getDateString(new Date(heatmapYear, 11, 31, 0, 0, 0, 0));
    const entries = [...globalDataObject.entries()];
    const relevantReadingGoals: ReadingGoalHeatmapGlobalDayData[] = [];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const [dateKey, readingGoal] = entries[index];

      if (dateKey > lastDayOfYearDateString) {
        break;
      }

      if (
        (readingGoal.readingGoalStartDate >= firstDayOfYearDateString &&
          readingGoal.readingGoalStartDate <= lastDayOfYearDateString) ||
        (firstDayOfYearDateString >= readingGoal.readingGoalStartDate &&
          firstDayOfYearDateString <= readingGoal.readingGoalEndDate)
      ) {
        relevantReadingGoals.push(readingGoal);
      }
    }

    if (heatmapAggregration === HeatmapDataAggregration.ALL_TIME) {
      currentHeatmapData = globalHeatmapData;
    } else if (heatmapDataByYear.has(heatmapYear)) {
      currentHeatmapData = heatmapDataByYear.get(heatmapYear)!;
    } else {
      const streaksInYear: HeatmapStreak[] = JSON.parse(
        JSON.stringify(
          globalHeatmapData.streaks.filter(
            (streak) =>
              (streak.startDate >= firstDayOfYearDateString &&
                streak.startDate <= lastDayOfYearDateString) ||
              (firstDayOfYearDateString >= streak.startDate &&
                firstDayOfYearDateString <= streak.endDate)
          )
        )
      );

      streaksInYear.sort(sortStreaks);

      completedReadingGoalsCount = 0;
      closedReadingGoalsCount = 0;

      for (let index = 0, { length } = relevantReadingGoals; index < length; index += 1) {
        const readingGoal = relevantReadingGoals[index];

        closedReadingGoalsCount += 1;

        if (readingGoal.normalizedReadingGoalCompletedPercentage === 100) {
          completedReadingGoalsCount += 1;
        }
      }

      const newMapData: ReadingGoalsHeatmapData = {
        streaks: streaksInYear,
        completedReadingGoals: getCompletedReadingGoalsLabel(
          completedReadingGoalsCount,
          closedReadingGoalsCount
        ),
        longestStreaks: getLongestStreaks(streaksInYear),
        currentStreak: getCurrentStreak(streaksInYear, todayKey)
      };

      heatmapDataByYear.set(heatmapYear, newMapData);
      currentHeatmapData = newMapData;
    }

    updateHeatmapDayData(relevantReadingGoals[0]);
  }

  function getDefaultHeatmapGlobalDayData(): HeatmapGlobalDayData {
    return { readingTime: 0, charactersRead: 0, titles: new Set<string>() };
  }

  function sortStreaks(streak1: HeatmapStreak, streak2: HeatmapStreak) {
    if (streak1.duration > streak2.duration) {
      return -1;
    }

    if (streak1.duration !== streak2.duration) {
      return 1;
    }

    return streak1.startDate > streak2.startDate ? 1 : -1;
  }

  function getDaysReadLabel(allDaysReadCount: number, daysRead: Set<string>) {
    let daysReadLabel = '';

    if (allDaysReadCount) {
      daysReadLabel = `${daysRead.size} / ${pluralize(allDaysReadCount, 'day')} (${
        allDaysReadCount ? caluclatePercentage(daysRead.size, allDaysReadCount) : 0
      }%)`;
    } else {
      daysReadLabel = '0 / 0 days (0%)';
    }

    return daysReadLabel;
  }

  function getLongestStreaks(streaks: HeatmapStreak[]) {
    const longestStreakDuration = streaks[0]?.duration;

    return longestStreakDuration
      ? streaks.filter((streak) => streak.duration === longestStreakDuration)
      : [];
  }

  function getCurrentStreak(streaks: HeatmapStreak[], dateKey: string) {
    let currentStreak: HeatmapStreak = { startDate: '', endDate: '', duration: 0 };

    for (let index = 0, { length } = streaks; index < length; index += 1) {
      const streak = streaks[index];

      if (dateKey >= streak.startDate && dateKey <= streak.endDate) {
        currentStreak = streak;
        break;
      }
    }

    return currentStreak;
  }

  function getColorRanges(minimumValue: number, maximumValue: number, forcedMax?: number) {
    const colorRangeslist: HeatmapColorRange[] = [{ limit: 0, color: '' }];

    if (maximumValue) {
      const steps = Math.ceil(maximumValue / 4);
      const colorMax = forcedMax || maximumValue - steps + minimumValue;
      const willExecute = minimumValue < maximumValue;

      if (willExecute) {
        for (let limit = minimumValue; limit < maximumValue; limit += steps) {
          if (limit) {
            colorRangeslist.push({
              limit,
              color: colorByRating(
                heatmapMinValueColor,
                heatmapMaxValueColor,
                minimumValue,
                colorMax,
                limit
              )
            });
          }
        }
      } else {
        colorRangeslist.push({
          limit: minimumValue,
          color: `#${heatmapMaxValueColor}`
        });
      }
    }

    colorRangeslist.reverse();

    return colorRangeslist;
  }

  function colorByRating(
    colorStart: string,
    colorEnd: String,
    minValue: number,
    maxValue: number,
    value: number
  ) {
    const colorRatio = limitToRange(0, 1, value / (maxValue - minValue));
    const r = Math.ceil(
      parseInt(colorStart.substring(0, 2), 16) * (1 - colorRatio) +
        parseInt(colorEnd.substring(0, 2), 16) * colorRatio
    );
    const g = Math.ceil(
      parseInt(colorStart.substring(2, 4), 16) * (1 - colorRatio) +
        parseInt(colorEnd.substring(2, 4), 16) * colorRatio
    );
    const b = Math.ceil(
      parseInt(colorStart.substring(4, 6), 16) * (1 - colorRatio) +
        parseInt(colorEnd.substring(4, 6), 16) * colorRatio
    );

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function toHex(valueToConvert: number | string) {
    const value = valueToConvert.toString(16);

    return value.length === 1 ? `0${value}` : value;
  }

  function getCompletedReadingGoalsLabel(
    completedReadingGoalsCount: number,
    closedReadingGoalsCount: number
  ) {
    return `${completedReadingGoalsCount} / ${pluralize(
      closedReadingGoalsCount,
      'goal'
    )} (${caluclatePercentage(completedReadingGoalsCount, closedReadingGoalsCount)}%)`;
  }

  function updateHeatmapDayData(initialReadingGoal: ReadingGoalHeatmapGlobalDayData | undefined) {
    const mapDays: StatisticsHeatmapDayData[] = [];

    let year = heatmapYear;
    const dateObject = new Date(year, 0, 1, 0, 0, 0, 0);
    const dayIndex = dateObject.getDay();
    let dateString = '';
    let daysToFill = 0;
    let dayNumber = 1;
    let heatmapRow = 2;
    let heatmapColumn = 3;

    if ($lastStartDayOfWeek$ !== dayIndex) {
      if (!$lastStartDayOfWeek$) {
        daysToFill = dayIndex;
      } else if (!dayIndex) {
        daysToFill = 7 - $lastStartDayOfWeek$;
      } else {
        daysToFill =
          $lastStartDayOfWeek$ > dayIndex
            ? 7 - Math.abs(dayIndex - $lastStartDayOfWeek$)
            : dayIndex - $lastStartDayOfWeek$;
      }
    }

    while (daysToFill > 0) {
      mapDays.push({
        dateString: `${-daysToFill}`,
        isCurrentYear: false,
        heatmapRow,
        heatmapColumn,
        color: '',
        dayDetails: [],
        readingTime: 0
      });

      heatmapRow += 1;
      daysToFill -= 1;
    }

    let currentReadingGoalWindow: ReadingGoalHeatmapGlobalDayData | undefined;
    let initialReadingGoalUsed = false;

    while (year === heatmapYear) {
      const monthIndex = dateObject.getMonth();

      dateString = getDateString(dateObject);

      if (!monthLabels[monthIndex].heatmapColumn) {
        monthLabels[monthIndex] = {
          ...monthLabels[monthIndex],
          ...{ heatmapColumn: `${heatmapColumn + 1}/${heatmapColumn + 3}` }
        };
      }

      if (heatmapType === HeatmapType.STATISTICS) {
        mapDays.push(getStatisticsHeatmapDayData(dateString, heatmapRow, heatmapColumn));
      } else {
        const result = getReadingGoalsHeatmapDayData(
          dateString,
          heatmapRow,
          heatmapColumn,
          currentReadingGoalWindow,
          initialReadingGoalUsed,
          initialReadingGoal
        );

        initialReadingGoalUsed = result.initialReadingGoalUsed;
        currentReadingGoalWindow = result.currentReadingGoalWindow;
        mapDays.push(result.statisticsHeatmapDay);
      }

      dateObject.setDate(dateObject.getDate() + 1);
      year = dateObject.getFullYear();
      dayNumber += 1;

      if (currentReadingGoalWindow && dateString === currentReadingGoalWindow.readingGoalEndDate) {
        currentReadingGoalWindow = undefined;
      }

      if (heatmapRow === 8) {
        heatmapColumn += 1;
        heatmapRow = 2;
      } else {
        heatmapRow += 1;
      }
    }

    while (heatmapRow < 9) {
      mapDays.push({
        dateString: `${dayNumber}`,
        isCurrentYear: false,
        heatmapRow,
        heatmapColumn,
        color: '',
        dayDetails: [],
        readingTime: 0
      });

      dayNumber += 1;
      heatmapRow += 1;
    }

    monthLabels = [...monthLabels];
    currentHeatmapDays = mapDays;

    tick().then(() => {
      if (heatmapYear === today.getFullYear()) {
        scrollToDay(todayKey);
      }
    });
  }

  function getStatisticsHeatmapDayData(
    dateString: string,
    heatmapRow: number,
    heatmapColumn: number
  ) {
    const dayData = globalHeatmapDayData.get(dateString);
    const statisticsHeatmapDay: StatisticsHeatmapDayData = dayData
      ? {
          dateString,
          isCurrentYear: true,
          heatmapRow,
          heatmapColumn,
          color: '',
          dayDetails: [
            dateString,
            `${secondsToMinutes(dayData.readingTime)} min`,
            `${dayData.charactersRead} characters`,
            pluralize(dayData.titles.size, 'title')
          ],
          readingTime: dayData.readingTime
        }
      : {
          dateString,
          isCurrentYear: true,
          heatmapRow,
          heatmapColumn,
          color: '',
          dayDetails: [dateString, `0 min`, `0 characters`, `0 titles`],
          readingTime: 0
        };

    const colorRangesToUse = checkIsStatisticsHeatmapData(currentHeatmapData)
      ? currentHeatmapData.colorRanges
      : colorRanges;

    if (statisticsHeatmapDay.isCurrentYear) {
      statisticsHeatmapDay.color =
        colorRangesToUse.find((r) => r.limit <= statisticsHeatmapDay.readingTime)?.color || '';
    }

    return statisticsHeatmapDay;
  }

  function getReadingGoalsHeatmapDayData(
    dateString: string,
    heatmapRow: number,
    heatmapColumn: number,
    existingReadingGoalWindow: ReadingGoalHeatmapGlobalDayData | undefined,
    readingGoalUsed: boolean,
    initialReadingGoal: ReadingGoalHeatmapGlobalDayData | undefined
  ) {
    const globalDataObject = globalHeatmapDayData as Map<string, ReadingGoalHeatmapGlobalDayData>;
    const statisticsHeatmapDay: StatisticsHeatmapDayData = {
      dateString,
      isCurrentYear: true,
      heatmapRow,
      heatmapColumn,
      color: '',
      dayDetails: [],
      readingTime: 0
    };
    let initialReadingGoalUsed = readingGoalUsed;
    let currentReadingGoalWindow = existingReadingGoalWindow;

    if (
      !initialReadingGoalUsed &&
      initialReadingGoal &&
      dateString >= initialReadingGoal.readingGoalStartDate
    ) {
      initialReadingGoalUsed = true;
      currentReadingGoalWindow = initialReadingGoal;
    } else {
      currentReadingGoalWindow = globalDataObject.get(dateString) || currentReadingGoalWindow;
    }

    if (currentReadingGoalWindow) {
      statisticsHeatmapDay.color =
        colorRanges.find(
          (r) => r.limit <= currentReadingGoalWindow!.normalizedReadingGoalCompletedPercentage
        )?.color || '';
      statisticsHeatmapDay.dayDetails.push(
        dateString,
        ...(currentReadingGoalWindow.readingGoalStartDate ===
        currentReadingGoalWindow.readingGoalEndDate
          ? []
          : [
              getDateRangeLabel(
                currentReadingGoalWindow.readingGoalStartDate,
                currentReadingGoalWindow.readingGoalEndDate
              )
            ]),
        pluralize(currentReadingGoalWindow.titles.size, 'title'),
        ...(currentReadingGoalWindow.timeGoal
          ? [
              `${secondsToMinutes(currentReadingGoalWindow.readingTime)} / ${secondsToMinutes(
                currentReadingGoalWindow.timeGoal
              )} min (${currentReadingGoalWindow.normalizedReadingTimePercentage}%)`
            ]
          : []),
        ...(currentReadingGoalWindow.characterGoal
          ? [
              `${currentReadingGoalWindow.charactersRead} / ${currentReadingGoalWindow.characterGoal} characters (${currentReadingGoalWindow.normalizedCharactersReadPercentage}%)`
            ]
          : []),
        ...(currentReadingGoalWindow.timeGoal && currentReadingGoalWindow.characterGoal
          ? [
              `Total Completion: ${currentReadingGoalWindow.normalizedReadingGoalCompletedPercentage}%`
            ]
          : [])
      );
    } else {
      statisticsHeatmapDay.dayDetails.push(
        dateString,
        `No ${dateString > todayKey ? 'Data' : 'Reading Goal'} for this Day`
      );
    }

    return { currentReadingGoalWindow, initialReadingGoalUsed, statisticsHeatmapDay };
  }
</script>

{$resizeHandler$ ?? ''}
<div class="mb-4 flex justify-center">
  {heatmapLabel}
  <button
    class="mx-4 hover:text-red-500"
    on:click={() => changeHeatmapYear(today.getFullYear() - heatmapYear)}
  >
    <Fa icon={faRepeat} />
  </button>
  <button
    class="text-lg hover:text-red-500"
    on:click={() =>
      (heatmapAggregration =
        heatmapAggregration === HeatmapDataAggregration.ALL_TIME
          ? HeatmapDataAggregration.YEAR
          : HeatmapDataAggregration.ALL_TIME)}
  >
    <Fa icon={faLayerGroup} />
  </button>
</div>
<div class="flex justify-between">
  <button
    class="hover:text-red-500"
    on:click={() => {
      if (heatmapElement.scrollLeft === 0) {
        changeHeatmapYear(-1);
      } else {
        heatmapElement.scrollBy({
          top: 0,
          left: -(heatmapElement.clientWidth / 2),
          behavior: 'smooth'
        });
      }
    }}
  >
    <Fa icon={faChevronLeft} />
  </button>
  <div
    class="grid items-center overflow-x-auto py-1"
    style:grid-auto-columns={`${dayElementSize}px`}
    style:grid-auto-rows={`${dayElementSize}px`}
    style:gap={`${heatmapGridGapValue}px`}
    style:margin={`0 ${heatmapDayMargins}px`}
    bind:this={heatmapElement}
  >
    {#each monthLabels as label (label.monthLabel)}
      <div
        class="text-xs md:text-sm"
        style:grid-row={'1/1'}
        style:grid-column={`${label.heatmapColumn}`}
        style:height={`${dayElementSize}px`}
        style:margin-bottom={`${dayElementSize}px`}
      >
        {label.monthLabel}
      </div>
    {/each}
    <div
      class="sticky left-0"
      style:grid-row={'1/1'}
      style:grid-column={`1/3`}
      style:height={`${dayElementSize * 2}px`}
      style:background-color={'var(--background-color)'}
    />
    {#each dayLabels as dayLabel, index (dayLabel)}
      <div
        class="sticky left-0 text-xs sm:text-sm"
        style:grid-row={`${index + 2}/${index + 2}`}
        style:grid-column={`1/3`}
        style:background-color={'var(--background-color)'}
      >
        {dayLabel}
      </div>
    {/each}
    {#each currentHeatmapDays as heatmapDay (heatmapDay.dateString)}
      {@const isToday = heatmapDay.dateString === todayKey}
      {@const isSelected =
        !isToday &&
        (heatmapDay.dateString === $lastStatisticsStartDate$ ||
          heatmapDay.dateString === $lastStatisticsEndDate$)}
      <div
        tabindex="0"
        role="cell"
        class="justify-self-center fadeIn"
        class:cursor-pointer={heatmapDay.isCurrentYear}
        class:bg-slate-300={heatmapDay.isCurrentYear}
        class:bg-slate-200={!heatmapDay.isCurrentYear}
        class:border-amber-500={isSelected}
        class:border-red-500={isToday}
        class:highlight={selectedStreakDates.has(heatmapDay.dateString)}
        style:animation-delay={`${3 * heatmapDay.heatmapColumn}ms`}
        style:height={`${dayElementSize}px`}
        style:width={`${dayElementSize}px`}
        style:grid-row={`${heatmapDay.heatmapRow}/${heatmapDay.heatmapRow}`}
        style:grid-column={`${heatmapDay.heatmapColumn}/${heatmapDay.heatmapColumn}`}
        style:background-color={heatmapDay.color || null}
        style:border-width={`${isSelected || isToday ? '3' : '1'}px`}
        title={`${heatmapDay.isCurrentYear ? `${heatmapDay.dayDetails.join('\n')}` : ''}`}
        data-date={heatmapDay.dateString}
        on:click={(event) => {
          if (!heatmapDay.isCurrentYear) {
            return;
          }

          popoverDetails = heatmapDay.dayDetails;

          tick().then(() => {
            if (event.target instanceof HTMLElement) {
              heatmapDetailDataPopover.toggleOpen(event.target);
            }
          });
        }}
        on:keyup={dummyFn}
      />
    {/each}
    {#if popoverDetails.length}
      <Popover yOffset={5} bind:this={heatmapDetailDataPopover}>
        <div
          slot="content"
          class="p-2"
          class:w-36={heatmapType === HeatmapType.STATISTICS}
          class:w-42={heatmapType === HeatmapType.READING_GOALS}
        >
          <button
            class="flex w-full justify-end absolute right-2"
            on:click={() => (popoverDetails = [])}
          >
            <Fa icon={faClose} />
          </button>
          {#each popoverDetails as popoverDetail (popoverDetail)}
            <div class="mb-2 last:mb-0">{popoverDetail}</div>
          {/each}
        </div>
      </Popover>
    {/if}
  </div>
  <button
    class="hover:text-red-500"
    on:click={() => {
      const scrollWidth =
        heatmapElement.scrollWidth - heatmapElement.scrollLeft - heatmapDayMargins;
      if (scrollWidth <= heatmapElement.clientWidth) {
        changeHeatmapYear(1);
      } else {
        heatmapElement.scrollBy({
          top: 0,
          left: heatmapElement.clientWidth / 2,
          behavior: 'smooth'
        });
      }
    }}
  >
    <Fa icon={faChevronRight} />
  </button>
</div>
{#if currentHeatmapData}
  {@const isAllTime = heatmapAggregration === HeatmapDataAggregration.ALL_TIME}
  {@const mapAggregationlabel = `(${isAllTime ? 'All Time' : heatmapYear})`}
  {@const typeLabel = `${heatmapType === HeatmapType.STATISTICS ? 'day' : 'goal'}`}
  {@const daysReadLabel = `Days read ${mapAggregationlabel}:`}
  {@const readingGoalsCompletedLabel = `100% completed ${mapAggregationlabel}:`}
  {@const longestStreaksLabel = `Longest ${pluralize(
    currentHeatmapData.longestStreaks.length,
    'Streak',
    false
  )} ${mapAggregationlabel}:`}
  {@const longestStreaksDuration = currentHeatmapData.longestStreaks[0]?.duration || 0}
  {@const longestStreaksCount = `${
    longestStreaksDuration
      ? ` (${pluralize(currentHeatmapData.longestStreaks.length, 'Time')})`
      : ''
  }`}
  {@const longestStreaksDays = `${longestStreaksDuration} ${pluralize(
    longestStreaksDuration,
    typeLabel,
    false
  )}`}
  {@const currentStreakLabel = `Current Streak ${mapAggregationlabel}:`}
  {@const currentStreakDays = pluralize(currentHeatmapData.currentStreak.duration, typeLabel)}
  <div class="hidden grid-cols-3 justify-center mt-4 text-center text-sm sm:grid">
    {#if checkIsStatisticsHeatmapData(currentHeatmapData)}
      <div>{daysReadLabel}</div>
    {:else}
      <button
        on:click={() =>
          highlightStreaks(currentHeatmapData.streaks, HeatmapStreakType.READING_GOALS_COMPLETED)}
      >
        {readingGoalsCompletedLabel}
      </button>
    {/if}
    <div>
      <button
        on:click={() =>
          highlightStreaks(currentHeatmapData.longestStreaks, HeatmapStreakType.LONGEST)}
      >
        {longestStreaksLabel}
      </button>
    </div>
    <div>
      <button
        on:click={() =>
          highlightStreaks(
            currentHeatmapData.currentStreak.duration ? [currentHeatmapData.currentStreak] : [],
            HeatmapStreakType.CURRENT
          )}
      >
        {currentStreakLabel}
      </button>
    </div>
    {#if checkIsStatisticsHeatmapData(currentHeatmapData)}
      <div>{currentHeatmapData.daysRead}</div>
    {:else}
      <button
        on:click={() =>
          highlightStreaks(currentHeatmapData.streaks, HeatmapStreakType.READING_GOALS_COMPLETED)}
      >
        {currentHeatmapData.completedReadingGoals}
      </button>
    {/if}
    <div>
      <button
        on:click={() =>
          highlightStreaks(currentHeatmapData.longestStreaks, HeatmapStreakType.LONGEST)}
      >
        {longestStreaksDays}{longestStreaksCount}
      </button>
    </div>
    <div>
      <button
        on:click={() =>
          highlightStreaks(
            currentHeatmapData.currentStreak.duration ? [currentHeatmapData.currentStreak] : [],
            HeatmapStreakType.CURRENT
          )}
      >
        {currentStreakDays}
      </button>
    </div>
  </div>
  <div class="grid grid-cols-[auto_auto] gap-y-2 mt-4 text-xs sm:hidden">
    {#if checkIsStatisticsHeatmapData(currentHeatmapData)}
      <div>{daysReadLabel}</div>
      <div>{currentHeatmapData.daysRead}</div>
    {:else}
      <button
        class="text-left"
        on:click={() =>
          highlightStreaks(currentHeatmapData.streaks, HeatmapStreakType.READING_GOALS_COMPLETED)}
      >
        {readingGoalsCompletedLabel}
      </button>
      <button
        class="text-left"
        on:click={() =>
          highlightStreaks(currentHeatmapData.streaks, HeatmapStreakType.READING_GOALS_COMPLETED)}
      >
        {currentHeatmapData.completedReadingGoals}
      </button>
    {/if}
    <button
      class="text-left"
      on:click={() =>
        highlightStreaks(currentHeatmapData.longestStreaks, HeatmapStreakType.LONGEST)}
    >
      {longestStreaksLabel}
    </button>
    <button
      class="text-left"
      on:click={() =>
        highlightStreaks(currentHeatmapData.longestStreaks, HeatmapStreakType.LONGEST)}
    >
      {longestStreaksDays}{longestStreaksCount}
    </button>
    <div>
      <button
        on:click={() =>
          highlightStreaks(
            currentHeatmapData.currentStreak.duration ? [currentHeatmapData.currentStreak] : [],
            HeatmapStreakType.CURRENT
          )}
      >
        {currentStreakLabel}
      </button>
    </div>
    <div>
      <button
        on:click={() =>
          highlightStreaks(
            currentHeatmapData.currentStreak.duration ? [currentHeatmapData.currentStreak] : [],
            HeatmapStreakType.CURRENT
          )}
      >
        {currentStreakDays}
      </button>
    </div>
  </div>
{/if}

<style>
  .highlight {
    box-shadow: 0px 1px 5px 1px black;
  }

  @media (min-width: 1024px) {
    .fadeIn {
      animation: fadeIn 0.1s ease-in backwards;
    }

    @keyframes fadeIn {
      0% {
        transform: scale3d(0, 0, 0);
      }
      100% {
        transform: scale3d(1, 1, 1);
      }
    }
  }
</style>
