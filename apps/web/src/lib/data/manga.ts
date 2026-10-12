/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Manga (CBZ/ZIP) is stored like a book, so library, storage and sync work unchanged:
 * the page images are its blobs and elementHtml holds a marker plus the page order.
 * Progress is a normal bookmark with the page index as exploredCharCount. Not upstream.
 */

import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';

const marker = '<!--ttu-manga-->';

export type MangaReadingMode = 'rtl' | 'ltr' | 'vertical';

/** Right to left by default, as in Japanese manga. */
export const mangaReadingMode$ = writableStringLocalStorageSubject<MangaReadingMode>()(
  'mangaReadingMode',
  'rtl'
);

export function isMangaFileName(name: string) {
  return /\.(?:cbz|zip)$/i.test(name);
}

export function sortPages(names: string[]) {
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function mangaElementHtml(pages: string[]) {
  return `${marker}${JSON.stringify(pages)}`;
}

export function isManga(book: { elementHtml: string }) {
  return book.elementHtml.startsWith(marker);
}

export function mangaPages(book: { elementHtml: string }): string[] {
  return isManga(book) ? JSON.parse(book.elementHtml.slice(marker.length)) : [];
}

export function mangaBookmark(
  dataId: number,
  page: number,
  pageCount: number
): BooksDbBookmarkData {
  return {
    dataId,
    exploredCharCount: page,
    progress: pageCount > 1 ? page / (pageCount - 1) : 0,
    lastBookmarkModified: Date.now()
  };
}

/**
 * Page turn for a tap at x (Mihon's default layout): the outer thirds turn the page,
 * the middle toggles the menu (0). In right-to-left manga the left side goes forward.
 */
export function tapDirection(x: number, width: number, mode: MangaReadingMode) {
  const side = x < width / 3 ? -1 : x > (width * 2) / 3 ? 1 : 0;

  return mode === 'rtl' ? -side : side;
}
