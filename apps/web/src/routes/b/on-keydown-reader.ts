/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { AutoScroller, PageManager } from '$lib/components/book-reader/types';
import {
  BookReaderAvailableKeybind,
  type BookReaderKeybindMap
} from '$lib/data/book-reader-keybind';

export function onKeydownReader(
  ev: KeyboardEvent,
  bookReaderKeybindMap: BookReaderKeybindMap,
  bookmarkPage: () => void,
  scrollToBookmark: () => void,
  multiplierOffsetFn: (offset: number) => void,
  autoScroller: AutoScroller | undefined,
  pageManager: PageManager | undefined,
  isVertical: boolean,
  changeChapter: (offset: number) => void
) {
  const action = bookReaderKeybindMap[ev.code];

  switch (action) {
    case BookReaderAvailableKeybind.BOOKMARK: {
      bookmarkPage();
      return true;
    }
    case BookReaderAvailableKeybind.JUMP_TO_BOOKMARK:
      scrollToBookmark();
      return true;
    case BookReaderAvailableKeybind.AUTO_SCROLL_TOGGLE:
      autoScroller?.toggle();
      return true;
    case BookReaderAvailableKeybind.AUTO_SCROLL_INCREASE:
      multiplierOffsetFn(1);
      return true;
    case BookReaderAvailableKeybind.AUTO_SCROLL_DECREASE:
      multiplierOffsetFn(-1);
      return true;
    case BookReaderAvailableKeybind.NEXT_PAGE:
      pageManager?.nextPage();
      return true;
    case BookReaderAvailableKeybind.PREV_PAGE:
      pageManager?.prevPage();
      return true;
    case BookReaderAvailableKeybind.PREV_CHAPTER:
      changeChapter(isVertical ? 1 : -1);
      return true;
    case BookReaderAvailableKeybind.NEXT_CHAPTER:
      changeChapter(isVertical ? -1 : 1);
      return true;
    default:
      return false;
  }
}
