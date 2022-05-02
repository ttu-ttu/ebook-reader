/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { BehaviorSubject } from 'rxjs';
import { dev } from '$app/env';
import { binarySearchNoNegative } from '$lib/functions/binary-search';
import { formatPos } from '$lib/functions/format-pos';
import { getCharacterCount } from '$lib/functions/get-character-count';
import { CharacterStatsCalculator } from '../book-reader-continuous/character-stats-calculator';
import { getParagraphNodes } from '../get-paragraph-nodes';

export class SectionCharacterStatsCalculator {
  readonly charCount: number;

  private readonly sectionAccCharCounts: number[];

  private sectionIndex = -1;

  private calculator: CharacterStatsCalculator | undefined;

  constructor(
    public readonly containerEl: HTMLElement,
    public readonly sections: ReadonlyArray<Element>,
    private virtualScrollPos$: BehaviorSubject<number>,
    private getWidth: () => number,
    private getHeight: () => number,
    private getPageGap: () => number,
    public verticalMode: boolean,
    private readonly scrollEl: HTMLElement,
    private readonly document: Document
  ) {
    const getSectionCharCount = (section: Element) => {
      const paragraphs = getParagraphNodes(section);
      return paragraphs.reduce((acc, cur) => acc + getCharacterCount(cur), 0);
    };
    let exploredCharCount = 0;
    this.sectionAccCharCounts = sections.map((section) => {
      exploredCharCount += getSectionCharCount(section);
      return exploredCharCount;
    });
    this.charCount = exploredCharCount;
  }

  updateCurrentSection(sectionIndex: number) {
    this.calculator = new CharacterStatsCalculator(
      this.containerEl,
      this.verticalMode ? 'horizontal' : 'vertical',
      'ltr',
      this.scrollEl,
      this.document
    );
    this.sectionIndex = sectionIndex;
  }

  updateParagraphPos() {
    if (!this.calculator) return;
    this.calculator.updateParagraphPos(this.virtualScrollPos$.getValue());
  }

  calcExploredCharCount() {
    if (dev && this.getPageGap() === 0) {
      // Scroll position must be beyond text size for character count increment
      throw new Error('Formula assumes non-zero page gap');
    }
    const offset = this.verticalMode ? 0 : -this.screenSize;
    return this.getCharCountByScrollPos(this.virtualScrollPos$.getValue() + offset);
  }

  getCharCountByScrollPos(scrollPos: number) {
    if (!this.calculator) return -1;
    const startCount = this.getSectionStartCount();
    return this.calculator.getCharCountByScrollPos(scrollPos) + startCount;
  }

  getSectionIndexByCharCount(charCount: number) {
    return binarySearchNoNegative(this.sectionAccCharCounts, charCount) + 1;
  }

  getScrollPosByCharCount(charCount: number) {
    if (!this.calculator) return -1;
    const startCount = this.getSectionStartCount();
    const endCount = this.sectionAccCharCounts[this.sectionIndex];
    const mirroredCount = charCount - startCount;
    const isEndChar = charCount === endCount && endCount - startCount > 0;
    if (mirroredCount < 0 || charCount > endCount || isEndChar) return -1;
    if (mirroredCount === 0) return 0;

    const index = binarySearchNoNegative(this.calculator.accumulatedCharCount, mirroredCount);
    const { accumulatedCharCount, paragraphPos } = this.calculator;
    const prevCharCount = accumulatedCharCount[index];
    if (Number.isNaN(Number(paragraphPos[index]))) return -1;

    const bestFitIndex = (from: number, to: number): number => {
      if (from >= to) return to;
      if (accumulatedCharCount[from] > prevCharCount) return from;
      return bestFitIndex(from + 1, to);
    };
    const scrollPos = paragraphPos[bestFitIndex(index + 1, accumulatedCharCount.length - 1)];

    const { screenSize } = this;
    const offsetCount = this.verticalMode ? -1 : 0;
    const screenPos = screenSize * (Math.ceil(scrollPos / screenSize) + offsetCount);
    return formatPos(screenPos, this.calculator.direction);
  }

  isCharOnScreen(charCount: number) {
    const scrollPos = this.getScrollPosByCharCount(charCount);
    const virtualPos = this.virtualScrollPos$.getValue();
    return scrollPos === virtualPos;
  }

  private getSectionStartCount() {
    return this.sectionAccCharCounts[this.sectionIndex - 1] || 0;
  }

  private get screenSize() {
    return (this.verticalMode ? this.getHeight() : this.getWidth()) + this.getPageGap();
  }
}
