/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Reading totals for the library's Home tab, from upstream's daily statistics.
 * Not part of upstream.
 */

import type { BooksDbStatistic } from '$lib/data/database/books-db/versions/books-db';

export interface LearnerStats {
  totalCharacters: number;
  /** Seconds */
  totalTime: number;
  /** Characters per hour */
  speed: number;
  todayCharacters: number;
  weekCharacters: number;
  /** Consecutive days with reading, ending today or yesterday */
  streak: number;
  longestStreak: number;
  daysRead: number;
  booksCompleted: number;
  booksStarted: number;
}

function dayNumber(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return Math.round(Date.UTC(year, month - 1, day) / 8.64e7);
}

/** `today` is the statistics date key of today (respecting the tracker's start of day). */
export function learnerStats(statistics: BooksDbStatistic[], today: string): LearnerStats {
  const todayNumber = dayNumber(today);
  const days = new Set<number>();
  let totalCharacters = 0;
  let totalTime = 0;
  let todayCharacters = 0;
  let weekCharacters = 0;

  statistics.forEach((statistic) => {
    const day = dayNumber(statistic.dateKey);
    const characters = Math.max(0, statistic.charactersRead || 0);

    totalCharacters += characters;
    totalTime += Math.max(0, statistic.readingTime || 0);

    if (characters > 0) {
      days.add(day);
    }
    if (day === todayNumber) {
      todayCharacters += characters;
    }
    if (day > todayNumber - 7 && day <= todayNumber) {
      weekCharacters += characters;
    }
  });

  const sortedDays = [...days].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;

  sortedDays.forEach((day, i) => {
    run = i && day === sortedDays[i - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  });

  let streak = 0;

  for (let day = days.has(todayNumber) ? todayNumber : todayNumber - 1; days.has(day); day -= 1) {
    streak += 1;
  }

  return {
    totalCharacters,
    totalTime,
    speed: totalTime ? Math.round(totalCharacters / (totalTime / 3600)) : 0,
    todayCharacters,
    weekCharacters,
    streak,
    longestStreak,
    daysRead: days.size,
    booksCompleted: new Set(statistics.filter((s) => s.completedBook).map((s) => s.title)).size,
    booksStarted: new Set(statistics.map((s) => s.title)).size
  };
}
