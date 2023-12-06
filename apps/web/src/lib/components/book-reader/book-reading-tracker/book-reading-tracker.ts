/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbStatistic } from '$lib/data/database/books-db/versions/books-db';
import { writableSubject } from '$lib/functions/svelte/store';

export const isTrackerMenuOpen$ = writableSubject<boolean>(false);

export const isTrackerPaused$ = writableSubject<boolean>(true);

export enum TrackerAutoPause {
  OFF = 'off',
  MODERATE = 'moderate',
  STRICT = 'strict'
}

export enum TrackerSkipThresholdAction {
  IGNORE = 'ignore',
  PAUSE = 'pause'
}

export enum ReadingGoalFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export interface TrackingHistory {
  id: number;
  dateKey: string;
  dateTimeKey: string;
  timeDiff: number;
  characterDiff: number;
  saved: boolean;
}

export function getDefaultStatistic(title: string, dateKey: string): BooksDbStatistic {
  return {
    title,
    dateKey,
    charactersRead: 0,
    readingTime: 0,
    minReadingSpeed: 0,
    altMinReadingSpeed: 0,
    lastReadingSpeed: 0,
    maxReadingSpeed: 0,
    lastStatisticModified: Date.now()
  };
}
