/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { SortDirection } from '$lib/data/sort-types';
import {
  compareBookCards,
  formatSeries,
  nextSortOption,
  orderSeries,
  titleVolume
} from './library-sort';
import { filterBookCards } from './library-filters';

function card(props: Partial<BookCardProps>): BookCardProps {
  return {
    id: 0,
    title: '',
    imagePath: '',
    characters: 0,
    lastBookModified: 0,
    lastBookOpen: 0,
    progress: 0,
    lastBookmarkModified: 0,
    isPlaceholder: false,
    ...props
  };
}

describe('library sort', () => {
  it('flips direction on the active property and picks defaults for new ones', () => {
    const current = { property: 'title', direction: SortDirection.ASC } as const;

    expect(nextSortOption(current, 'title').direction).toBe(SortDirection.DESC);
    expect(nextSortOption(current, 'difficulty').direction).toBe(SortDirection.ASC);
    expect(nextSortOption(current, 'lastBookOpen').direction).toBe(SortDirection.DESC);
  });

  it('keeps volumes in reading order and books without difficulty last', () => {
    const v2 = card({ title: 'B 2', series: 'S', seriesIndex: 2 });
    const v1 = card({ title: 'B 1', series: 'S', seriesIndex: 1 });
    const desc = { property: 'series', direction: SortDirection.DESC } as const;

    expect([v2, v1].sort((a, b) => compareBookCards(a, b, desc))).toEqual([v1, v2]);

    const easy = card({ title: 'e', difficulty: 1 });
    const none = card({ title: 'n' });
    const hard = card({ title: 'h', difficulty: 4 });
    const byDifficulty = { property: 'difficulty', direction: SortDirection.DESC } as const;

    expect([none, easy, hard].sort((a, b) => compareBookCards(a, b, byDifficulty))).toEqual([
      hard,
      easy,
      none
    ]);
  });

  it('sorts titles with numbers naturally', () => {
    const asc = { property: 'title', direction: SortDirection.ASC } as const;
    const titles = ['巻10', '巻2', '巻1'].map((title) => card({ title }));

    expect(titles.sort((a, b) => compareBookCards(a, b, asc)).map((c) => c.title)).toEqual([
      '巻1',
      '巻2',
      '巻10'
    ]);
  });

  it('formats series', () => {
    expect(formatSeries({ series: 'S', seriesIndex: 3 })).toBe('S #3');
    expect(formatSeries({ series: '', seriesIndex: 3 })).toBe('');
  });
});

describe('library filters', () => {
  const cards = [
    card({ title: 'Unread', tags: ['SF'] }),
    card({ title: 'Reading', progress: 0.5, authors: '著者', lastBookOpen: 1000 }),
    card({ title: 'Done', progress: 1, tags: ['SF', 'Mystery'] })
  ];

  it('filters by status and search term', () => {
    expect(filterBookCards(cards, 'reading', '').map((c) => c.title)).toEqual(['Reading']);
    expect(filterBookCards(cards, 'all', 'mystery').map((c) => c.title)).toEqual(['Done']);
    expect(filterBookCards(cards, 'all', '著者').map((c) => c.title)).toEqual(['Reading']);
    expect(filterBookCards(cards, 'unknown-key', '')).toHaveLength(3);
  });

  it('searches manga only', () => {
    const withManga = [...cards, card({ title: 'Done 漫画', manga: true })];

    expect(filterBookCards(withManga, 'manga', 'done').map((c) => c.title)).toEqual(['Done 漫画']);
    expect(filterBookCards(withManga, 'books', 'done').map((c) => c.title)).toEqual(['Done']);
  });

  it('splits 100k-300k characters into three lengths', () => {
    const lengths = [120_000, 180_000, 250_000].map((characters) =>
      card({ title: `${characters}`, characters })
    );

    expect(filterBookCards(lengths, 'medium-long', '').map((c) => c.title)).toEqual(['180000']);
  });
});

describe('titleVolume', () => {
  it('reads digits, full-width digits, kanji numerals and 上/下', () => {
    expect(
      [
        '魔女の旅々 10',
        'ダンタリアンの書架１２',
        '第十二巻',
        '物語 二十一巻',
        '本 (下)',
        '前編',
        'none'
      ].map(titleVolume)
    ).toEqual([10, 12, 12, 21, 3, 1, undefined]);
  });
});

describe('orderSeries', () => {
  const titles = (books: { title: string }[]) => books.map((b) => b.title);

  it('orders by the volume in the title when Calibre indexes are all the same', () => {
    const books = ['S 10', 'S 2', 'S 1', 'S 11', 'S'].map((title) => ({
      title,
      series: 'S',
      seriesIndex: 1
    }));

    expect(titles(orderSeries(books))).toEqual(['S', 'S 1', 'S 2', 'S 10', 'S 11']);
  });

  it('uses distinct Calibre indexes and ignores numbers in the series name', () => {
    expect(
      titles(
        orderSeries([
          { title: 'B', seriesIndex: 2 },
          { title: 'A', seriesIndex: 10 },
          { title: 'C', seriesIndex: 1 }
        ])
      )
    ).toEqual(['C', 'B', 'A']);
    expect(
      titles(
        orderSeries(
          ['86―エイティシックス― Ep.3', '86―エイティシックス―', '86―エイティシックス― Ep.2'].map(
            (title) => ({ title, series: '86―エイティシックス―' })
          )
        )
      )
    ).toEqual(['86―エイティシックス―', '86―エイティシックス― Ep.2', '86―エイティシックス― Ep.3']);
  });
});
