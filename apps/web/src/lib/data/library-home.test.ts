/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import {
  addToHome,
  homeBookTitles$,
  matchingSeries,
  removeFromHome,
  seriesGroups
} from './library-home';
import { filterBookCards, seriesFilterKey } from '$lib/components/book-card/library-filters';

const card = (title: string, series?: string, seriesIndex?: number, authors = '') =>
  ({ id: title.length, title, series, seriesIndex, authors }) as BookCardProps;

const cards = [
  card('魔女の旅々 2', '魔女の旅々', 2),
  card('魔女の旅々 1', '魔女の旅々', 1),
  card('Other', 'Single', 1),
  card('涼宮ハルヒの憂鬱', 'ハルヒ', 1, '谷川流'),
  card('涼宮ハルヒの溜息', 'ハルヒ', 2, '谷川流'),
  card('Standalone')
];

describe('matchingSeries', () => {
  it('finds series by name, book title or author, in reading order', () => {
    expect(matchingSeries(cards, '魔女').map((m) => m.books.map((b) => b.title))).toEqual([
      ['魔女の旅々 1', '魔女の旅々 2']
    ]);
    expect(matchingSeries(cards, '溜息')[0].series).toBe('ハルヒ');
    expect(matchingSeries(cards, '谷川')[0].books).toHaveLength(2);
  });

  it('skips one-book series and empty searches', () => {
    expect(matchingSeries(cards, 'other')).toEqual([]);
    expect(matchingSeries(cards, ' ')).toEqual([]);
  });
});

describe('home titles', () => {
  it('adds without duplicates and removes', () => {
    homeBookTitles$.next([]);
    addToHome(['a', 'b']);
    addToHome(['b', 'c']);
    removeFromHome('a');

    expect(homeBookTitles$.getValue()).toEqual(['b', 'c']);
  });
});

describe('seriesGroups', () => {
  it('groups books by series in reading order, first volume first', () => {
    const groups = seriesGroups([
      ...cards,
      { ...card('魔女の旅々 0'), series: '魔女の旅々', seriesIndex: null, progress: 0.5 }
    ]);

    expect(groups.map((g) => [g.series, g.books.map((b) => b.title)[0], g.books.length])).toEqual([
      ['Single', 'Other', 1],
      ['ハルヒ', '涼宮ハルヒの憂鬱', 2],
      ['魔女の旅々', '魔女の旅々 0', 3]
    ]);
    expect(groups[2].started).toBe(1);
  });

  it('filters the Store to one series', () => {
    expect(filterBookCards(cards, seriesFilterKey('ハルヒ'), '').map((c) => c.title)).toEqual([
      '涼宮ハルヒの憂鬱',
      '涼宮ハルヒの溜息'
    ]);
  });
});
