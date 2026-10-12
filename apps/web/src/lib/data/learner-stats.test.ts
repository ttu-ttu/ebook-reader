/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BooksDbStatistic } from '$lib/data/database/books-db/versions/books-db';
import { buildSearchIndex } from '$lib/functions/book-text/book-search';
import { countKanji, getKanjiSummary, recordKanjiSeen, summarizeKanji } from './kanji-seen';
import { learnerStats } from './learner-stats';

const stat = (title: string, dateKey: string, charactersRead: number, extra = {}) =>
  ({ title, dateKey, charactersRead, readingTime: 1800, ...extra }) as BooksDbStatistic;

describe('learnerStats', () => {
  it('totals reading and finds streaks', () => {
    const stats = learnerStats(
      [
        stat('A', '2026-10-11', 1000),
        stat('B', '2026-10-10', 2000),
        stat('A', '2026-10-09', 500, { completedBook: 1 }),
        stat('A', '2026-09-01', 100),
        stat('A', '2026-09-02', 100),
        stat('A', '2026-09-03', 100),
        stat('A', '2026-09-04', 100),
        stat('C', '2026-09-05', 0)
      ],
      '2026-10-11'
    );

    expect(stats).toMatchObject({
      totalCharacters: 3900,
      todayCharacters: 1000,
      weekCharacters: 3500,
      streak: 3,
      longestStreak: 4,
      daysRead: 7,
      booksCompleted: 1,
      booksStarted: 3,
      speed: 975
    });
  });

  it('keeps a streak that ended yesterday', () => {
    expect(learnerStats([stat('A', '2026-10-10', 1)], '2026-10-11').streak).toBe(1);
    expect(learnerStats([stat('A', '2026-10-09', 1)], '2026-10-11').streak).toBe(0);
  });
});

describe('kanji seen', () => {
  it('counts kanji only', () => {
    expect(countKanji('漢字の漢、カナ々')).toEqual({ 漢: 2, 字: 1 });
  });

  it('counts each stretch once and skips long jumps', async () => {
    const index = buildSearchIndex(`<p>猫と犬</p><p>${'あ'.repeat(30_000)}</p><p>鳥</p>`);

    await recordKanjiSeen('K', index, 2);
    await recordKanjiSeen('K', index, 3);
    await recordKanjiSeen('K', index, 1);
    await recordKanjiSeen('K', index, 30_004);

    expect(await getKanjiSummary()).toEqual({ unique: 2 });
  });

  it('summarises across books', () => {
    const summary = summarizeKanji([
      { title: 'a', upTo: 1, counts: { 猫: 3, 犬: 1 } },
      { title: 'b', upTo: 1, counts: { 猫: 1 } }
    ]);

    expect(summary).toEqual({ unique: 2 });
  });
});
