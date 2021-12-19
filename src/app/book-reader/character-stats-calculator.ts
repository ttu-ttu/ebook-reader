/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import binarySearch from '../utils/binary-search';
import formatScrollPos from '../utils/format-scroll-pos';
import getCharacterCount from '../utils/get-character-count';

export default class CharacterStatsCalculator {
  readonly charCount: number;

  private readonly paragraphs: HTMLElement[];

  private readonly paragraphPos: number[];

  private readonly accumulatedCharCount: number[];

  constructor(
    public readonly containerEl: HTMLElement,
    private verticalMode: boolean,
    private readonly scrollEl: HTMLElement
  ) {
    this.paragraphs = Array.from(containerEl.getElementsByTagName('p'));

    if (this.paragraphs.length === 0) {
      const potentialParagraphs = Array.from(containerEl.querySelectorAll('*'))
        .filter(
          (p): p is HTMLElement =>
            p instanceof HTMLElement &&
            !p.attributes.getNamedItem('aria-hidden') &&
            p.parentElement?.tagName !== 'RUBY'
        )
        .filter((p) => {
          for (const pChild of p.childNodes) {
            if (
              pChild.nodeType === Node.TEXT_NODE &&
              pChild.textContent &&
              pChild.textContent.trim().length > 0
            ) {
              return true;
            }
          }
          return false;
        });
      const potentialParagraphsSet = new Set(potentialParagraphs);
      this.paragraphs = potentialParagraphs.filter(
        (p) => !potentialParagraphsSet.has(p.parentElement!)
      );
    }

    this.paragraphPos = Array(this.paragraphs.length);
    this.accumulatedCharCount = [];
    let exploredCharCount = 0;
    for (const el of this.paragraphs) {
      exploredCharCount += getCharacterCount(el);
      this.accumulatedCharCount.push(exploredCharCount);
    }
    this.charCount = exploredCharCount;
  }

  getVerticalMode() {
    return this.verticalMode;
  }

  setVerticalMode(verticalMode: boolean) {
    this.verticalMode = verticalMode;
    this.updateParagraphPos();
  }

  updateParagraphPos() {
    const scrollElRect = this.scrollEl.getBoundingClientRect();
    const scrollElRight = this.verticalMode
      ? -scrollElRect.right
      : scrollElRect.top;
    for (let i = 0; i < this.paragraphs.length; i += 1) {
      const el = this.paragraphs[i];

      const elRect = el.getBoundingClientRect();
      const elLeft = this.verticalMode ? -elRect.left : elRect.bottom;
      this.paragraphPos[i] = elLeft - scrollElRight;
    }
  }

  calcExploredCharCount() {
    const scrollPos = this.verticalMode
      ? this.scrollEl.scrollLeft
      : this.scrollEl.scrollTop;
    return this.getCharCountByScrollPos(
      formatScrollPos(scrollPos, this.verticalMode)
    );
  }

  getCharCountByScrollPos(scrollPos: number) {
    const index = binarySearch(this.paragraphPos, scrollPos, true);
    return this.accumulatedCharCount[index] || 0;
  }

  getScrollPosByCharCount(charCount: number) {
    const index = binarySearch(this.accumulatedCharCount, charCount, true);
    return formatScrollPos(this.paragraphPos[index], this.verticalMode);
  }
}
