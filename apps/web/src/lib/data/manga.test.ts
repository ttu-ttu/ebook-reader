/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  isManga,
  isMangaFileName,
  mangaBookmark,
  mangaElementHtml,
  mangaPages,
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
});
