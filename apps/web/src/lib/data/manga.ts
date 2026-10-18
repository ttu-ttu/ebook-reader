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
import { writableBooleanLocalStorageSubject } from '$lib/data/internal/writable-boolean-local-storage-subject';
import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';

const marker = '<!--ttu-manga-->';

export type MangaReadingMode = 'rtl' | 'ltr' | 'vertical';

/** Right to left by default, as in Japanese manga. */
export const mangaReadingMode$ = writableStringLocalStorageSubject<MangaReadingMode>()(
  'mangaReadingMode',
  'rtl'
);

/** How a page fits the screen in the paged modes (Mihon's scale types). */
export type MangaScale = 'screen' | 'width' | 'height' | 'original' | 'smart';

export type MangaDualPage = 'auto' | 'on' | 'off';

export type MangaBackground = 'black' | 'gray' | 'white' | 'auto';

export const mangaScale$ = writableStringLocalStorageSubject<MangaScale>()('mangaScale', 'screen');

/** Two pages side by side: auto means on screens wider than tall. */
export const mangaDualPage$ = writableStringLocalStorageSubject<MangaDualPage>()(
  'mangaDualPage',
  'auto'
);

export const mangaBackground$ = writableStringLocalStorageSubject<MangaBackground>()(
  'mangaBackground',
  'black'
);

export const mangaDoubleTapZoom$ = writableBooleanLocalStorageSubject()('mangaDoubleTapZoom', true);

export const mangaKeepScreenOn$ = writableBooleanLocalStorageSubject()('mangaKeepScreenOn', true);

export const mangaPageNumber$ = writableBooleanLocalStorageSubject()('mangaPageNumber', true);

export interface PageSize {
  width: number;
  height: number;
}

function isWide(size: PageSize | undefined) {
  return !!size && size.width > size.height;
}

/**
 * Pages grouped as they are shown: one each, or pairs when dual. The cover, wide pages (already a
 * spread) and the last page stand alone; shift pairs the cover too, for books whose pairs are off by
 * one. Pages whose size isn't known yet count as portrait.
 */
export function pageSpreads(sizes: (PageSize | undefined)[], dual: boolean, shift: boolean) {
  const groups: number[][] = [];

  for (let i = 0; i < sizes.length; ) {
    const alone =
      !dual ||
      i === sizes.length - 1 ||
      (i === 0 && !shift) ||
      isWide(sizes[i]) ||
      isWide(sizes[i + 1]);

    groups.push(alone ? [i] : [i, i + 1]);
    i += alone ? 1 : 2;
  }

  return groups;
}

/**
 * Size of a group of pages (laid out side by side at one height) before zooming. Smart fit is fit
 * screen, except a spread on a portrait screen fits its height, to be panned across.
 */
export function fitSize(scale: MangaScale, pages: PageSize[], view: PageSize): PageSize {
  const aspect = pages.reduce((sum, page) => sum + page.width / page.height, 0);
  const contain = Math.min(view.height, view.width / aspect);
  const height = {
    screen: contain,
    width: view.width / aspect,
    height: view.height,
    original: Math.max(...pages.map((page) => page.height)),
    smart: aspect > view.width / view.height && view.width < view.height ? view.height : contain
  }[scale];

  return { width: height * aspect, height };
}

/** Offset of content along one axis: centred when it fits, else kept covering the view. */
export function clampPan(offset: number, content: number, view: number) {
  if (content <= view) return (view - content) / 2;

  return Math.min(0, Math.max(view - content, offset));
}

/** Average colour of the outer ring of a size×size RGBA image, as CSS (auto background). */
export function borderColor(data: ArrayLike<number>, size: number) {
  const sum = [0, 0, 0];
  let count = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) continue;

      const i = (y * size + x) * 4;

      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
      count += 1;
    }
  }

  return `rgb(${sum.map((value) => Math.round(value / count)).join(', ')})`;
}

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
