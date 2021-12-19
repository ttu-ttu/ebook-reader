/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Inject, Injectable } from '@angular/core';
import { DatabaseService } from '../database/books-db/database.service';
import { BooksDbBookmarkData } from '../database/books-db/versions/books-db';
import BookmarkData from '../models/bookmark-data.model';
import { WINDOW } from '../utils/dom-tokens';
import formatScrollPos from '../utils/format-scroll-pos';
import CharacterStatsCalculator from './character-stats-calculator';

type TargetScroll = { scrollX: number } | { scrollY: number };

@Injectable({
  providedIn: 'root',
})
export class BookmarkManagerService {
  constructor(
    private db: DatabaseService,
    @Inject(WINDOW) private window: Window
  ) {}

  async scrollToSavedPosition(
    bookId: number,
    calculator: CharacterStatsCalculator
  ): Promise<BookmarkData | undefined> {
    const targetScroll = await this.getBookmarkPosition(bookId, calculator);
    if (targetScroll) {
      const { scrollToData, bookmarkData } = resolveTargetScroll(targetScroll);
      this.window.scrollTo(scrollToData);
      return bookmarkData;
    }
    return undefined;
  }

  async saveScrollPosition(
    bookId: number,
    calculator: CharacterStatsCalculator
  ): Promise<BookmarkData> {
    const exploredCharCount = calculator.calcExploredCharCount();
    const bookCharCount = calculator.charCount;

    const partialSaveData: BooksDbBookmarkData = {
      dataId: bookId,
      exploredCharCount,
      progress: exploredCharCount / bookCharCount,
    };
    if (calculator.getVerticalMode()) {
      this.db.putBookmark({
        ...partialSaveData,
        scrollX: this.window.scrollX,
      });
      return {
        right: `${-this.window.scrollX}px`,
      };
    }
    this.db.putBookmark({
      ...partialSaveData,
      scrollY: this.window.scrollY,
    });
    return {
      top: `${this.window.scrollY}px`,
    };
  }

  async getBookmarkBarPosition(
    bookId: number,
    calculator: CharacterStatsCalculator
  ): Promise<BookmarkData | undefined> {
    const targetScroll = await this.getBookmarkPosition(bookId, calculator);
    if (targetScroll) {
      const { bookmarkData } = resolveTargetScroll(targetScroll);
      return bookmarkData;
    }
    return undefined;
  }

  private async getBookmarkPosition(
    bookId: number,
    calculator: CharacterStatsCalculator
  ): Promise<TargetScroll | undefined> {
    const bookmark = await this.db.getBookmark(bookId);
    if (bookmark) {
      if (bookmark.exploredCharCount) {
        const verticalMode = calculator.getVerticalMode();
        const subData = {
          exploredCharCount: bookmark.exploredCharCount,
          verticalMode,
          calculator,
        };
        if (verticalMode) {
          if (
            bookmark.scrollX &&
            verifyScrollPosValidity({
              ...subData,
              scrollPos: bookmark.scrollX,
            })
          ) {
            return {
              scrollX: bookmark.scrollX,
            };
          }
        } else if (
          bookmark.scrollY &&
          verifyScrollPosValidity({
            ...subData,
            scrollPos: bookmark.scrollY,
          })
        ) {
          return {
            scrollY: bookmark.scrollY,
          };
        }

        const scrollPos = calculator.getScrollPosByCharCount(
          bookmark.exploredCharCount
        );
        if (verticalMode) {
          return {
            scrollX: scrollPos,
          };
        }
        return {
          scrollY: scrollPos,
        };
      }
    }
    return undefined;
  }
}

function resolveTargetScroll(targetScroll: TargetScroll): {
  bookmarkData: BookmarkData;
  scrollToData: ScrollToOptions;
} {
  if ('scrollX' in targetScroll) {
    return {
      scrollToData: {
        left: targetScroll.scrollX,
      },
      bookmarkData: {
        right: `${-targetScroll.scrollX}px`,
      },
    };
  }
  return {
    scrollToData: {
      top: targetScroll.scrollY,
    },
    bookmarkData: {
      top: `${targetScroll.scrollY}px`,
    },
  };
}

function verifyScrollPosValidity(data: {
  scrollPos: number;
  exploredCharCount: number;
  verticalMode: boolean;
  calculator: CharacterStatsCalculator;
}) {
  const { scrollPos, exploredCharCount, verticalMode, calculator } = data;
  return (
    calculator.getCharCountByScrollPos(
      formatScrollPos(scrollPos, verticalMode)
    ) === exploredCharCount
  );
}
