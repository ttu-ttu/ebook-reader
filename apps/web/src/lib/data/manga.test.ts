/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  borderColor,
  clampPan,
  fitSize,
  isManga,
  isMangaFileName,
  mangaBookmark,
  mangaElementHtml,
  mangaPages,
  pageSpreads,
  sortPages,
  tapDirection
} from './manga';

describe('manga', () => {
  it('stores the page order in elementHtml', () => {
    const book = { elementHtml: mangaElementHtml(sortPages(['10.jpg', 'a/2.png', '1.jpg'])) };

    expect(isManga(book)).toBe(true);
    expect(mangaPages(book)).toEqual(['1.jpg', '10.jpg', 'a/2.png']);
    expect(isManga({ elementHtml: '<p>本</p>' })).toBe(false);
  });

  it('sorts page numbers naturally', () => {
    expect(sortPages(['p10.jpg', 'p2.jpg', 'p1.jpg'])).toEqual(['p1.jpg', 'p2.jpg', 'p10.jpg']);
  });

  it('recognises archives', () => {
    expect(isMangaFileName('巻1.CBZ')).toBe(true);
    expect(isMangaFileName('x.zip')).toBe(true);
    expect(isMangaFileName('x.epub')).toBe(false);
  });

  it('keeps progress at 0 on the first page and 1 on the last', () => {
    expect(mangaBookmark(1, 0, 10).progress).toBe(0);
    expect(mangaBookmark(1, 9, 10).progress).toBe(1);
    expect(mangaBookmark(1, 4, 10).exploredCharCount).toBe(4);
  });

  it('turns pages by tap side and direction', () => {
    expect(tapDirection(10, 300, 'rtl')).toBe(1);
    expect(tapDirection(290, 300, 'rtl')).toBe(-1);
    expect(tapDirection(10, 300, 'ltr')).toBe(-1);
    expect(tapDirection(150, 300, 'ltr')).toBe(0);
  });

  it('pairs pages, leaving the cover, spreads and the last page alone', () => {
    const tall = { width: 7, height: 10 };
    const wide = { width: 14, height: 10 };

    expect(pageSpreads([tall, tall, tall, wide, tall, tall], true, false)).toEqual([
      [0],
      [1, 2],
      [3],
      [4, 5]
    ]);
    expect(pageSpreads([tall, tall, tall, tall], true, true)).toEqual([
      [0, 1],
      [2, 3]
    ]);
    expect(pageSpreads([tall, undefined, tall], true, false)).toEqual([[0], [1, 2]]);
    expect(pageSpreads([tall, tall], false, false)).toEqual([[0], [1]]);
  });

  it('fits pages to the screen', () => {
    const view = { width: 1000, height: 800 };
    const page = { width: 600, height: 1200 };

    expect(fitSize('screen', [page], view)).toEqual({ width: 400, height: 800 });
    expect(fitSize('width', [page], view)).toEqual({ width: 1000, height: 2000 });
    expect(fitSize('height', [page, page], view)).toEqual({ width: 800, height: 800 });
    expect(fitSize('original', [page], view)).toEqual(page);
    // A spread on a phone fits its height; a page fits the screen.
    const phone = { width: 400, height: 800 };

    expect(fitSize('smart', [{ width: 2000, height: 1000 }], phone)).toEqual({
      width: 1600,
      height: 800
    });
    expect(fitSize('smart', [page], phone)).toEqual({ width: 400, height: 800 });
  });

  it('centres content that fits and keeps larger content covering the view', () => {
    expect(clampPan(-50, 200, 400)).toBe(100);
    expect(clampPan(50, 800, 400)).toBe(0);
    expect(clampPan(-900, 800, 400)).toBe(-400);
    expect(clampPan(-100, 800, 400)).toBe(-100);
  });

  it('averages the border of a sample', () => {
    const data = new Array(3 * 3 * 4).fill(255);

    data.splice(4 * 4, 4, 0, 0, 0, 255); // the centre doesn't count

    expect(borderColor(data, 3)).toBe('rgb(255, 255, 255)');
  });
});
