/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * The library's Home tab (current reads and the books you picked) and Store tab
 * (the whole library, e.g. the Calibre catalog), with series search so a whole
 * series can be added at once. Not part of upstream.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { orderSeries } from '$lib/components/book-card/library-sort';
import { writableObjectLocalStorageSubject } from '$lib/data/internal/writable-object-local-storage-subject';
import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';

export type LibraryTab = 'home' | 'store';

export const libraryTab$ = writableStringLocalStorageSubject()('libraryTab', 'home');

/** Store → Books or Series */
export const storeView$ = writableStringLocalStorageSubject()('libraryStoreView', 'books');

/** Titles added to Home from the Store (titles are how books are identified across devices). */
export const homeBookTitles$ = writableObjectLocalStorageSubject<string[]>()('homeBookTitles', []);

export function addToHome(titles: string[]) {
  homeBookTitles$.next([...new Set([...homeBookTitles$.getValue(), ...titles])]);
}

export function removeFromHome(title: string) {
  homeBookTitles$.next(homeBookTitles$.getValue().filter((t) => t !== title));
}

export interface SeriesMatch {
  series: string;
  books: BookCardProps[];
}

/**
 * Series whose name matches the search, or that contain a book whose title or
 * author matches, with all their books in reading order.
 */
export function matchingSeries(bookCards: BookCardProps[], searchTerm: string, limit = 6) {
  const term = searchTerm.trim().toLocaleLowerCase();

  if (!term) {
    return [];
  }

  const bySeries = new Map<string, BookCardProps[]>();

  bookCards.forEach((card) => {
    if (card.series) {
      bySeries.set(card.series, [...(bySeries.get(card.series) ?? []), card]);
    }
  });

  const matches: (SeriesMatch & { byName: boolean })[] = [];

  bySeries.forEach((books, series) => {
    const byName = series.toLocaleLowerCase().includes(term);
    const byBook = books.some(
      (book) =>
        book.title.toLocaleLowerCase().includes(term) ||
        !!book.authors?.toLocaleLowerCase().includes(term)
    );

    if ((byName || byBook) && books.length > 1) {
      matches.push({
        series,
        byName,
        books: orderSeries(books)
      });
    }
  });

  return matches
    .sort((a, b) => Number(b.byName) - Number(a.byName) || b.books.length - a.books.length)
    .slice(0, limit)
    .map(({ series, books }): SeriesMatch => ({ series, books }));
}

export interface SeriesGroup {
  series: string;
  /** In reading order; the first one's cover stands for the series */
  books: BookCardProps[];
  started: number;
}

/** Books grouped by series, by name. Books without a series are left out. */
export function seriesGroups(bookCards: BookCardProps[]): SeriesGroup[] {
  const bySeries = new Map<string, BookCardProps[]>();

  bookCards.forEach((card) => {
    if (card.series) {
      bySeries.set(card.series, [...(bySeries.get(card.series) ?? []), card]);
    }
  });

  return [...bySeries.entries()]
    .map(([series, books]) => ({
      series,
      books: orderSeries(books),
      started: books.filter((book) => book.progress > 0).length
    }))
    .sort((a, b) => a.series.localeCompare(b.series, 'ja'));
}
