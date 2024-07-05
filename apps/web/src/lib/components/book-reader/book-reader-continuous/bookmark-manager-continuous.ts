/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookmarkManager } from '../types';
import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
import type { CharacterStatsCalculator } from './character-stats-calculator';
import { formatPos } from '$lib/functions/format-pos';

export class BookmarkManagerContinuous implements BookmarkManager {
  constructor(
    private calculator: CharacterStatsCalculator,
    private window: Window,
    private firstDimensionMargin: number
  ) {}

  scrollToBookmark(bookmarkData: BooksDbBookmarkData, customReadingPointScrollOffset = 0) {
    const targetScroll = this.getBookmarkPosition(bookmarkData);
    if (!targetScroll) return;

    const { scrollToData } = resolveTargetScroll(targetScroll, this.firstDimensionMargin);
    const scrollProperty = this.calculator.verticalMode ? 'left' : 'top';

    if (scrollToData.left !== undefined && scrollProperty === 'left') {
      scrollToData.left += customReadingPointScrollOffset;
    } else if (scrollToData.top !== undefined && scrollProperty === 'top') {
      scrollToData.top -= customReadingPointScrollOffset;
    }

    this.window.scrollTo(scrollToData);
  }

  formatBookmarkData(bookId: number, customReadingPointScrollOffset = 0): BooksDbBookmarkData {
    const exploredCharCount = this.calculator.calcExploredCharCount(customReadingPointScrollOffset);
    const bookCharCount = this.calculator.charCount;

    const { verticalMode } = this.calculator;
    const scrollAxis = verticalMode ? 'scrollX' : 'scrollY';

    return {
      dataId: bookId,
      exploredCharCount,
      progress: exploredCharCount / bookCharCount,
      [scrollAxis]: this.window[scrollAxis],
      lastBookmarkModified: new Date().getTime()
    };
  }

  formatBookmarkDataByRange(bookId: number): BooksDbBookmarkData {
    return this.formatBookmarkData(bookId);
  }

  getBookmarkBarPosition(bookmarkData: BooksDbBookmarkData): BookmarkPosData | undefined {
    const targetScroll = this.getBookmarkPosition(bookmarkData);
    if (!targetScroll) return undefined;

    return resolveTargetScroll(targetScroll, this.firstDimensionMargin).bookmarkPosData;
  }

  private getBookmarkPosition(bookmark: BooksDbBookmarkData): TargetScroll | undefined {
    if (!bookmark.exploredCharCount) return undefined;

    const { verticalMode } = this.calculator;

    const targetScrollByScrollPos = this.getBookmarkTargetPosByScrollValue(bookmark);
    if (targetScrollByScrollPos) return targetScrollByScrollPos;

    const scrollPos = this.calculator.getScrollPosByCharCount(bookmark.exploredCharCount);
    if (verticalMode) {
      return {
        scrollX: scrollPos
      };
    }
    return {
      scrollY: scrollPos
    };
  }

  private getBookmarkTargetPosByScrollValue(bookmarkData: BooksDbBookmarkData) {
    const { exploredCharCount } = bookmarkData;

    const getTargetPos = (scrollAxis: 'scrollX' | 'scrollY') => {
      const scrollPos = bookmarkData[scrollAxis];
      if (!scrollPos) return undefined;

      const formattedScrollPos = formatPos(scrollPos, this.calculator.direction);
      if (this.calculator.getCharCountByScrollPos(formattedScrollPos) === exploredCharCount) {
        return {
          [scrollAxis]: scrollPos
        } as TargetScroll;
      }
      return undefined;
    };

    return this.calculator.verticalMode ? getTargetPos('scrollX') : getTargetPos('scrollY');
  }
}

function resolveTargetScroll(
  targetScroll: TargetScroll,
  dimensionAdjustment: number
): {
  bookmarkPosData: BookmarkPosData;
  scrollToData: ScrollToOptions;
} {
  if ('scrollX' in targetScroll) {
    return {
      scrollToData: {
        left: targetScroll.scrollX
      },
      bookmarkPosData: {
        right: `${-targetScroll.scrollX + dimensionAdjustment}px`
      }
    };
  }
  return {
    scrollToData: {
      top: targetScroll.scrollY
    },
    bookmarkPosData: {
      top: `${targetScroll.scrollY + dimensionAdjustment}px`
    }
  };
}

type TargetScroll = { scrollX: number } | { scrollY: number };

export interface BookmarkPosData {
  top?: string;
  right?: string;
}
