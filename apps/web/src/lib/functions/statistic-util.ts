/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookStatistic } from '$lib/components/statistics/statistics-types';
import type { BooksDbStatistic } from '$lib/data/database/books-db/versions/books-db';

export function getDate(referenceDateString: string, startOfDay = 0) {
  return new Date(`${referenceDateString}T${`${startOfDay}`.padStart(2, '0')}:00:00`);
}

export function getStartHoursDate(startOfDay: number, startDate = new Date()) {
  const referenceDate = startDate;
  const targetDate = new Date(referenceDate.getTime());

  targetDate.setHours(startOfDay);
  targetDate.setMinutes(0);
  targetDate.setSeconds(0);
  targetDate.setMilliseconds(0);

  if (referenceDate.getHours() < targetDate.getHours()) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  return targetDate;
}

export function getDateKey(startOfDay: number, referenceDate = new Date()) {
  return getDateString(getStartHoursDate(startOfDay, referenceDate));
}

export function getPreviousDayKey(
  startOfDay: number,
  referenceDate = new Date(),
  ignoreStartOfDay = false
) {
  const dayAfter = referenceDate;
  const previousDay = new Date(dayAfter.getTime());

  previousDay.setHours(startOfDay);
  previousDay.setMinutes(0);
  previousDay.setSeconds(0);
  previousDay.setMilliseconds(0);
  previousDay.setDate(previousDay.getDate() - 1);

  if (!ignoreStartOfDay && dayAfter.getHours() < previousDay.getHours()) {
    previousDay.setDate(previousDay.getDate() - 1);
  }

  return getDateString(previousDay);
}

export function advanceDateDays(referenceDate: Date, daysToAdvance = 1) {
  referenceDate.setDate(referenceDate.getDate() + daysToAdvance);

  return { referenceDate, dateString: getDateString(referenceDate) };
}

export function getSecondsToDate(startOfDay: number, referenceDate = new Date()) {
  const dateObject = referenceDate;
  const targetDate = getStartHoursDate(startOfDay, new Date(dateObject.getTime()));

  return Math.floor((dateObject.getTime() - targetDate.getTime()) / 1000);
}

export function getDaysBetween(
  firstDay: Date | undefined,
  secondDay: Date | undefined,
  dayAdjustment = 1
) {
  if (!firstDay || !secondDay) {
    return 0;
  }

  return Math.round((secondDay.getTime() - firstDay.getTime()) / 8.64e7) + dayAdjustment;
}

export function toTimeString(s: number) {
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s - hours * 3600) / 60);
  const seconds = Math.floor(s - hours * 3600 - minutes * 60);

  return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(
    2,
    '0'
  )}`;
}

export function secondsToMinutes(seconds: number) {
  return Math.floor((seconds / 60 + Number.EPSILON) * 100) / 100;
}

export function getDateString(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    '0'
  )}-${`${date.getDate()}`.padStart(2, '0')}`;
}

export function getDateTimeString(timeInMs: number) {
  const date = new Date(timeInMs);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    '0'
  )}-${`${date.getDate()}`.padStart(2, '0')} ${`${date.getHours()}`.padStart(
    2,
    '0'
  )}:${`${date.getMinutes()}`.padStart(2, '0')}:${`${date.getSeconds()}`.padStart(2, '0')}`;
}

export function getWeekNumber(referenceDate: number, startDate: number) {
  const days = Math.floor((referenceDate - startDate) / (24 * 60 * 60 * 1000));
  return Math.ceil(days / 7);
}

export function mergeStatistics(
  statistics: BooksDbStatistic[] = [],
  existingStatistics: BooksDbStatistic[] = [],
  isNewOnly = true
) {
  const groupedStatistics = new Map<string, BooksDbStatistic>();

  for (let index = 0, { length } = existingStatistics; index < length; index += 1) {
    const existingStatistic = existingStatistics[index];

    groupedStatistics.set(existingStatistic.dateKey, existingStatistic);
  }

  for (let index = 0, { length } = statistics; index < length; index += 1) {
    const statistic = statistics[index];
    const existingStatistic = groupedStatistics.get(statistic.dateKey);

    if (
      !isNewOnly ||
      !existingStatistic ||
      statistic.lastStatisticModified > existingStatistic.lastStatisticModified
    ) {
      groupedStatistics.set(statistic.dateKey, statistic);
    }
  }

  return [...groupedStatistics.values()];
}

export function updateStatisticToStore(
  mergedStatistics: BooksDbStatistic[],
  fallbackLastModified: number
) {
  const statisticsToStore = mergedStatistics;
  const statisticsWithCompletionFlag = statisticsToStore.filter((entry) => entry.completedBook);

  let statisticWithCompletionFlag = statisticsWithCompletionFlag[0];
  let newStatisticModified = 0;

  for (let index = 1, { length } = statisticsWithCompletionFlag; index < length; index += 1) {
    const entry = statisticsWithCompletionFlag[index];

    statisticWithCompletionFlag =
      entry.lastStatisticModified > statisticWithCompletionFlag.lastStatisticModified
        ? entry
        : statisticWithCompletionFlag;
  }

  for (let index = 0, { length } = statisticsToStore; index < length; index += 1) {
    const statistic = statisticsToStore[index];

    if (
      statisticWithCompletionFlag &&
      statistic.dateKey === statisticWithCompletionFlag.dateKey &&
      statistic.lastStatisticModified === statisticWithCompletionFlag.lastStatisticModified
    ) {
      statistic.completedBook = 1;
    } else {
      delete statistic.completedBook;
      delete statistic.completedData;
    }

    newStatisticModified = Math.max(newStatisticModified, statistic.lastStatisticModified);
    statisticsToStore[index] = statistic;
  }

  statisticsToStore.sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));

  return { statisticsToStore, newStatisticModified: newStatisticModified || fallbackLastModified };
}

export function getNumberFromObject(data: BookStatistic, key: keyof BookStatistic) {
  return data[key] as number;
}
