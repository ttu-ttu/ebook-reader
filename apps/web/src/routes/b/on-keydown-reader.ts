/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { AutoScroller, PageManager } from '$lib/components/book-reader/types';
import {
  BookReaderAvailableKeybind,
  type BookReaderKeybindMap
} from '$lib/data/book-reader-keybind';
import {
  StatisticsTabAvailableKeybind,
  type StatisticsTabKeybindMap
} from '$lib/data/statistics-tab-keybind';

export function onKeydownReader(
  ev: KeyboardEvent,
  bookReaderKeybindMap: BookReaderKeybindMap,
  bookmarkPage: () => void,
  scrollToBookmark: () => void,
  multiplierOffsetFn: (offset: number) => void,
  autoScroller: AutoScroller | undefined,
  pageManager: PageManager | undefined,
  isVertical: boolean,
  changeChapter: (offset: number) => void,
  handleSetCustomReadingPoint: () => void,
  toggleTracker: () => void,
  freezeTrackerPosition: () => void
) {
  const action = bookReaderKeybindMap[ev.code || ev.key?.toLowerCase()];

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
    case BookReaderAvailableKeybind.SET_READING_POINT:
      handleSetCustomReadingPoint();
      return true;
    case BookReaderAvailableKeybind.TOGGLE_TRACKING:
      toggleTracker();
      return true;
    case BookReaderAvailableKeybind.TOGGLE_TRACKING_FREEZE:
      freezeTrackerPosition();
      return true;
    default:
      return false;
  }
}

export function onKeyUpStatisticsTab(
  ev: KeyboardEvent,
  statisticsTabKeybindMap: StatisticsTabKeybindMap,
  toggleStatisticsRangeTemplate: () => void,
  toggleAggregationMode: () => void
) {
  const action = statisticsTabKeybindMap[ev.code || ev.key?.toLowerCase()];

  switch (action) {
    case StatisticsTabAvailableKeybind.RANGE_TEMPLATE_TOGGLE:
      toggleStatisticsRangeTemplate();
      return true;
    case StatisticsTabAvailableKeybind.AGGREGRATION_TOGGLE:
      toggleAggregationMode();
      return true;
    default:
      return false;
  }
}
