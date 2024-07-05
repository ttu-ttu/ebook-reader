/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import {
  binarySearch,
  binarySearchNoNegative,
  binarySearchNodeInRange
} from '$lib/functions/binary-search';

import { formatPos } from '$lib/functions/format-pos';
import { getCharacterCount } from '$lib/functions/get-character-count';
import { getNodeBoundingRect } from '$lib/functions/range-util';
import { getParagraphNodes } from '$lib/components/book-reader/get-paragraph-nodes';

export class CharacterStatsCalculator {
  readonly charCount: number;

  readonly accumulatedCharCount: number[];

  readonly paragraphPos: number[];

  private readonly paragraphs: Node[];

  private paragraphPosToAccCharCount = new Map<number, number>();

  constructor(
    public readonly containerEl: HTMLElement,
    private readonly axis: 'horizontal' | 'vertical',
    public readonly direction: 'ltr' | 'rtl',
    private readonly scrollEl: HTMLElement,
    private readonly document: Document
  ) {
    this.paragraphs = getParagraphNodes(containerEl);

    this.paragraphPos = Array(this.paragraphs.length);
    this.accumulatedCharCount = [];
    let exploredCharCount = 0;
    this.paragraphs.forEach((node) => {
      exploredCharCount += getCharacterCount(node);
      this.accumulatedCharCount.push(exploredCharCount);
    });
    this.charCount = exploredCharCount;
  }

  get verticalMode() {
    return this.axis === 'vertical';
  }

  updateParagraphPos(scrollPos = 0) {
    const scrollElRect = this.scrollEl.getBoundingClientRect();
    const scrollElRight = formatPos(
      this.verticalMode ? scrollElRect.right : scrollElRect.top,
      this.direction
    );
    const dimensionAdjustment = Number(
      getComputedStyle(this.containerEl)[this.verticalMode ? 'paddingRight' : 'paddingTop'].replace(
        /px$/,
        ''
      )
    );
    const paragraphPosToIndices = new Map<number, number[]>();
    for (let i = 0; i < this.paragraphs.length; i += 1) {
      const node = this.paragraphs[i];

      const nodeRect = getNodeBoundingRect(this.document, node);

      const getParagraphPos = () => {
        const paragraphSize = this.verticalMode ? nodeRect.width : nodeRect.height;
        if (paragraphSize <= 0) {
          return this.paragraphPos[i - 1] || 0;
        }
        const nodeLeft = formatPos(
          this.verticalMode ? nodeRect.left : nodeRect.bottom,
          this.direction
        );

        return nodeLeft - scrollElRight - dimensionAdjustment + scrollPos;
      };
      const paragraphPos = getParagraphPos();
      this.paragraphPos[i] = paragraphPos;

      const indices = paragraphPosToIndices.get(paragraphPos) || [];
      paragraphPosToIndices.set(paragraphPos, indices);
      indices.push(i);
    }

    this.paragraphPosToAccCharCount = new Map(
      Array.from(paragraphPosToIndices.entries()).map(([paragraphPos, indices]) => [
        paragraphPos,
        Math.max(...indices.map((i) => this.accumulatedCharCount[i]))
      ])
    );
  }

  calcExploredCharCount(customReadingPointScrollOffset = 0) {
    return this.getCharCountByScrollPos(this.scrollPos + customReadingPointScrollOffset);
  }

  getCharCountByScrollPos(scrollPos: number) {
    const index = binarySearchNoNegative(this.paragraphPos, scrollPos);
    return this.paragraphPosToAccCharCount.get(this.paragraphPos[index]) || 0;
  }

  getBookMarkPosForSection(startCount: number, charCount: number) {
    const index = Math.max(0, binarySearch(this.accumulatedCharCount, charCount - startCount));

    let finalIndex = index;
    let bookmarkPos = this.processSectionBookmarkIteration(index, startCount, charCount);

    if (!bookmarkPos) {
      for (let i = index + 1, { length } = this.accumulatedCharCount; i < length; i += 1) {
        bookmarkPos = this.processSectionBookmarkIteration(i, startCount, charCount);

        if (bookmarkPos) {
          finalIndex = i;
          break;
        }
      }
    }

    return {
      bookmarkPos,
      node: bookmarkPos ? this.paragraphs[finalIndex] : undefined,
      isFirstNode: finalIndex === 0
    };
  }

  getScrollPosByCharCount(charCount: number) {
    const index = binarySearchNoNegative(this.accumulatedCharCount, charCount);
    return formatPos(this.paragraphPos[index], this.direction) || 0;
  }

  getCharCountToPoint(customReadingPoint: Range) {
    const index = Math.max(0, binarySearchNodeInRange(this.paragraphs, customReadingPoint));
    return this.accumulatedCharCount[index - 1] || 0;
  }

  private processSectionBookmarkIteration(index: number, startCount: number, charCount: number) {
    const currentCharSum = this.accumulatedCharCount[index] + startCount;

    let bookmarkPos;

    if (currentCharSum > charCount) {
      let container = this.paragraphs[index];

      if (container.parentElement) {
        container = container.parentElement.closest('p') || container.parentElement;
      }

      const { top, right, left } = getNodeBoundingRect(this.document, container);

      bookmarkPos = this.axis === 'horizontal' ? { left: right } : { top, left };
    }

    return bookmarkPos;
  }

  private get scrollPos() {
    return formatPos(this.scrollEl[this.scrollPosProp], this.direction);
  }

  private get scrollPosProp() {
    return this.verticalMode ? 'scrollLeft' : 'scrollTop';
  }
}
