/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import {
  advanceDateDays,
  getDate,
  getDateString,
  getStartHoursDate,
  toTimeString
} from '$lib/functions/statistic-util';

import type { BooksDbReadingGoal } from '$lib/data/database/books-db/versions/books-db';
import { ReadingGoalFrequency } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
import { database } from '$lib/data/store';

export interface ReadingGoal {
  timeGoal: number;
  characterGoal: number;
  goalFrequency: ReadingGoalFrequency;
  goalStartDate: string;
  lastGoalModified: number;
}

export interface ReadingGoalArchivalOption {
  label: string;
  archivalStartDate: string;
  archivalEndDate: string;
  editable: boolean;
}

export interface ReadingGoalSaveResult {
  readingGoalsToDelete: string[];
  readingGoalsToInsert: BooksDbReadingGoal[];
  error: string;
}

export async function getCurrentReadingGoal(givenReadingGoals?: BooksDbReadingGoal[]) {
  const readingGoals = await (givenReadingGoals
    ? Promise.resolve(givenReadingGoals)
    : database.getOpenReadingGoals());
  const openReadingGoals = readingGoals.filter((readingGoal) => !readingGoal.goalEndDate);

  return (
    openReadingGoals[openReadingGoals.length - 1] || {
      timeGoal: 0,
      characterGoal: 0,
      goalFrequency: ReadingGoalFrequency.DAILY,
      goalStartDate: '',
      goalEndDate: '',
      goalOriginalEndDate: '',
      lastGoalModified: Date.now()
    }
  );
}

export function getReadingGoalWindow(
  todayKey: string,
  startDayHoursForTracker: number,
  readingGoal: ReadingGoal
) {
  let readingGoalStart = '';
  let readingGoalEnd = '';

  if (readingGoal.goalFrequency === ReadingGoalFrequency.DAILY) {
    readingGoalStart = todayKey;
    readingGoalEnd = todayKey;
  } else if (readingGoal.goalFrequency === ReadingGoalFrequency.WEEKLY) {
    const todayDate = getStartHoursDate(startDayHoursForTracker);
    const readingGoalStartDate = getDate(readingGoal.goalStartDate, startDayHoursForTracker);
    const todayDay = todayDate.getDay() || 7;
    const readingGoalStartDateDay = readingGoalStartDate.getDay() || 7;

    if (todayDay !== readingGoalStartDateDay) {
      const dayDiff = readingGoalStartDateDay - todayDay;

      todayDate.setDate(todayDate.getDate() + dayDiff - (dayDiff > 0 ? 7 : 0));
    }

    ({ dateString: readingGoalStart } = advanceDateDays(todayDate, 0));
    ({ dateString: readingGoalEnd } = advanceDateDays(todayDate, 6));
  } else {
    // eslint-disable-next-line prefer-const
    let { referenceDate: readingGoalStartDate, dateString: readingGoalStartReference } =
      advanceDateDays(getDate(readingGoal.goalStartDate), 0);

    while (readingGoalStartReference <= todayKey) {
      readingGoalStart = readingGoalStartReference;

      ({ dateString: readingGoalStartReference } = advanceDateDays(readingGoalStartDate, 30));
    }

    ({ dateString: readingGoalEnd } = advanceDateDays(getDate(readingGoalStart), 29));
  }

  const readingGoalEndDate = getDate(readingGoalEnd, startDayHoursForTracker);

  return [
    readingGoalStart,
    getDateString(readingGoalEndDate),
    toTimeString((readingGoalEndDate.getTime() + 8.64e7 - Date.now()) / 1000)
  ];
}

export function mergeReadingGoals(
  readingGoals: BooksDbReadingGoal[] = [],
  existingReadingGoals: BooksDbReadingGoal[] = [],
  isNewOnly = true,
  fallbackLastModified = 0
) {
  const dataWithoutOpenReadingGoals = readingGoals.filter((entry) => entry.goalEndDate);
  const existingDataWithoutOpenReadingGoals: BooksDbReadingGoal[] = existingReadingGoals.filter(
    (entry: BooksDbReadingGoal) => entry.goalEndDate
  );
  const mergedReadingGoals: BooksDbReadingGoal[] = [];
  const combinedReadingGoals = [
    ...existingDataWithoutOpenReadingGoals,
    ...dataWithoutOpenReadingGoals
  ];
  const readingGoalsFromSource = new Map<string, BooksDbReadingGoal>();

  let newReadingGoalModified = 0;
  let currentIndex = 0;

  combinedReadingGoals.sort(readingGoalSortFunction);

  if (!isNewOnly) {
    for (let index = 0, { length } = readingGoals; index < length; index += 1) {
      const readingGoal = readingGoals[index];

      readingGoalsFromSource.set(readingGoal.goalStartDate, readingGoal);
    }
  }

  while (currentIndex <= combinedReadingGoals.length - 1) {
    const referenceReadingGoal = combinedReadingGoals[currentIndex];
    const overlappingReadingGoals = [];

    for (let index = currentIndex, { length } = combinedReadingGoals; index < length; index += 1) {
      const entry = combinedReadingGoals[index];
      const entryFromSource = readingGoalsFromSource.get(entry.goalStartDate);
      const isFromSource =
        entryFromSource &&
        entry.timeGoal === entryFromSource.timeGoal &&
        entry.characterGoal === entryFromSource.characterGoal &&
        entry.goalFrequency === entryFromSource.goalFrequency &&
        entry.goalEndDate === entryFromSource.goalEndDate &&
        entry.lastGoalModified === entryFromSource.lastGoalModified;

      if (
        (referenceReadingGoal.goalStartDate >= entry.goalStartDate &&
          referenceReadingGoal.goalStartDate <= entry.goalEndDate) ||
        (entry.goalStartDate >= referenceReadingGoal.goalStartDate &&
          entry.goalStartDate <= referenceReadingGoal.goalEndDate)
      ) {
        overlappingReadingGoals.push({ entry, index, isFromSource });
      }
    }

    if (overlappingReadingGoals.length > 1) {
      let latestReadingGoal = overlappingReadingGoals[0];

      for (
        let index2 = 1, { length: length2 } = overlappingReadingGoals;
        index2 < length2;
        index2 += 1
      ) {
        const overlappingReadingGoal = overlappingReadingGoals[index2];

        if (
          (!latestReadingGoal.isFromSource && overlappingReadingGoal.isFromSource) ||
          (!(latestReadingGoal.isFromSource && !overlappingReadingGoal.isFromSource) &&
            overlappingReadingGoal.entry.lastGoalModified >
              latestReadingGoal.entry.lastGoalModified)
        ) {
          latestReadingGoal = overlappingReadingGoal;
        }
      }

      const readingGoalsToRemove = overlappingReadingGoals.filter(
        (currentEntry) => currentEntry.index !== latestReadingGoal.index
      );

      for (let index2 = readingGoalsToRemove.length - 1; index2 >= 0; index2 -= 1) {
        combinedReadingGoals.splice(readingGoalsToRemove[index2].index, 1);
      }
    } else {
      mergedReadingGoals.push(referenceReadingGoal);
      currentIndex += 1;
    }
  }

  let maxEndDate = mergedReadingGoals[0]?.goalEndDate || '';

  for (let index = 1, { length } = mergedReadingGoals; index < length; index += 1) {
    const mergedReadingGoal = mergedReadingGoals[index];

    maxEndDate =
      mergedReadingGoal.goalEndDate > maxEndDate ? mergedReadingGoal.goalEndDate : maxEndDate;
  }

  const combinedValidOpenReadingGoals: BooksDbReadingGoal[] = [
    ...readingGoals.filter(
      (entry: BooksDbReadingGoal) => !entry.goalEndDate && entry.goalStartDate > maxEndDate
    ),
    ...existingReadingGoals.filter(
      (entry: BooksDbReadingGoal) => !entry.goalEndDate && entry.goalStartDate > maxEndDate
    )
  ];

  let lastModifiedValidOpenReadingGoal = combinedValidOpenReadingGoals[0];

  for (let index = 1, { length } = combinedValidOpenReadingGoals; index < length; index += 1) {
    const combinedValidOpenGoal = combinedValidOpenReadingGoals[index];

    lastModifiedValidOpenReadingGoal =
      combinedValidOpenGoal.lastGoalModified > lastModifiedValidOpenReadingGoal.lastGoalModified
        ? combinedValidOpenGoal
        : lastModifiedValidOpenReadingGoal;
  }

  if (lastModifiedValidOpenReadingGoal) {
    mergedReadingGoals.push(lastModifiedValidOpenReadingGoal);
  }

  for (let index = 0, { length } = mergedReadingGoals; index < length; index += 1) {
    newReadingGoalModified = Math.max(
      newReadingGoalModified,
      mergedReadingGoals[index].lastGoalModified
    );
  }

  return {
    readingGoalsToStore: mergedReadingGoals,
    newReadingGoalModified: newReadingGoalModified || fallbackLastModified
  };
}

export function readingGoalSortFunction(a: BooksDbReadingGoal, b: BooksDbReadingGoal) {
  if (a.goalStartDate > b.goalStartDate) {
    return 1;
  }

  if (a.goalStartDate !== b.goalStartDate) {
    return -1;
  }

  return a.goalEndDate > b.goalEndDate ? 1 : -1;
}

export function getDateRangeLabel(startDateString: string, endDateString: string) {
  return `${startDateString}${
    endDateString && endDateString !== startDateString ? ` - ${endDateString} ` : ''
  } `;
}
