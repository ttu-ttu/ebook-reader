/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { SortDirection, type SortOption } from '$lib/data/sort-types';

const ascendingByDefault = new Set<SortOption['property']>(['title', 'series', 'difficulty']);
const titleCollator = new Intl.Collator('ja-JP', { numeric: true });

/**
 * Clicking the active sort property flips its direction; clicking a new one
 * starts A→Z for titles and series, easiest first for difficulty and
 * newest/largest first for everything else.
 */
export function nextSortOption(current: SortOption, property: SortOption['property']): SortOption {
  if (current.property === property) {
    return {
      property,
      direction: current.direction === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC
    };
  }

  return {
    property,
    direction: ascendingByDefault.has(property) ? SortDirection.ASC : SortDirection.DESC
  };
}

export function formatSeries(card: Pick<BookCardProps, 'series' | 'seriesIndex'>) {
  if (!card.series) {
    return '';
  }

  return card.seriesIndex === null || card.seriesIndex === undefined
    ? card.series
    : `${card.series} #${card.seriesIndex}`;
}

export function compareBookCards(card1: BookCardProps, card2: BookCardProps, sort: SortOption) {
  const direction = sort.direction === SortDirection.ASC ? 1 : -1;
  let diff = 0;

  if (sort.property === 'title') {
    diff = direction * titleCollator.compare(card1.title, card2.title);
  } else if (sort.property === 'series') {
    // Standalone books sort among the series by their title; volumes stay in reading order.
    diff =
      direction * titleCollator.compare(card1.series || card1.title, card2.series || card2.title) ||
      (card1.seriesIndex ?? 0) - (card2.seriesIndex ?? 0);
  } else if (sort.property === 'difficulty') {
    const missing1 = card1.difficulty === undefined;
    const missing2 = card2.difficulty === undefined;

    // Books without an estimate always go last.
    diff =
      missing1 || missing2
        ? Number(missing1) - Number(missing2)
        : direction * ((card1.difficulty ?? 0) - (card2.difficulty ?? 0));
  } else {
    const value1 = card1[sort.property];
    const value2 = card2[sort.property];

    diff = direction * ((Number(value1) || 0) - (Number(value2) || 0));
  }

  // Ties (e.g. never-opened books) list the most recently added first.
  if (!diff && sort.property !== 'lastBookModified') {
    diff = card2.lastBookModified - card1.lastBookModified;
  }

  return diff || titleCollator.compare(card1.title, card2.title);
}

const kanjiDigits: Record<string, number> = {
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

function kanjiNumber(text: string) {
  let total = 0;
  let current = 0;

  for (const char of text) {
    if (char === '百') {
      total += (current || 1) * 100;
      current = 0;
    } else if (char === '十') {
      total += (current || 1) * 10;
      current = 0;
    } else {
      current = current * 10 + kanjiDigits[char];
    }
  }

  return total + current;
}

const partWords: Record<string, number> = { 上: 1, 前: 1, 中: 2, 下: 3, 後: 2 };

/**
 * Volume number written in a title: the last number (full-width and circled
 * digits included), else a kanji numeral after 第 or before 巻/部/集, else
 * 上/中/下 or 前/後(編).
 */
export function titleVolume(title: string): number | undefined {
  const text = title.normalize('NFKC');
  const digits = [...text.matchAll(/\d+(?:\.\d+)?/g)];

  if (digits.length) {
    return Number(digits[digits.length - 1][0]);
  }

  const kanji = [
    ...text.matchAll(/第([〇一二三四五六七八九十百]+)|([〇一二三四五六七八九十百]+)[巻部集]/g)
  ];

  if (kanji.length) {
    const last = kanji[kanji.length - 1];

    return kanjiNumber(last[1] ?? last[2]);
  }

  const part = text.match(/(上|中|下|前|後)(?:巻|編)?[\s)）】\]]*$/);

  return part ? partWords[part[1]] : undefined;
}

type SeriesBook = { title: string; series?: string; seriesIndex?: number | null };

/** The title without the series name, so a number in the name (86―エイティシックス―) isn't read as the volume. */
function volumeText(book: SeriesBook) {
  const title = book.title.normalize('NFKC');
  const series = book.series?.normalize('NFKC');

  return series && title.includes(series) ? title.replace(series, '') : title;
}

/**
 * Volume of each book of one series: Calibre's series index when it tells the
 * books apart, otherwise the number in the title (imports often leave every
 * index at 1 or empty).
 */
export function seriesVolumes<T extends SeriesBook>(books: T[]) {
  const indexes = books.map((book) => book.seriesIndex).filter((i): i is number => i != null);
  const indexesUsable = indexes.length === books.length && new Set(indexes).size === books.length;

  return new Map(
    books.map((book) => [
      book,
      indexesUsable
        ? book.seriesIndex!
        : (titleVolume(volumeText(book)) ?? book.seriesIndex ?? undefined)
    ])
  );
}

/**
 * One series' books in reading order. Books without a volume number come first:
 * that is usually an unnumbered first volume. Ties go by title, numbers compared
 * as numbers.
 */
export function orderSeries<T extends SeriesBook>(books: T[]) {
  const volumes = seriesVolumes(books);

  return [...books].sort(
    (a, b) =>
      (volumes.get(a) ?? 0) - (volumes.get(b) ?? 0) || titleCollator.compare(a.title, b.title)
  );
}
