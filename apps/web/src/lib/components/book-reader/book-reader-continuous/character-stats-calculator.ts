/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { binarySearchNoNegative } from '$lib/functions/binary-search';
import { formatPos } from '$lib/functions/format-pos';
import { getCharacterCount } from '$lib/functions/get-character-count';
import { getParagraphNodes } from '../get-paragraph-nodes';

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

    const paragraphPosToIndices = new Map<number, number[]>();
    for (let i = 0; i < this.paragraphs.length; i += 1) {
      const node = this.paragraphs[i];

      const nodeRect = this.getNodeBoundingRect(node);
      const nodeLeft = formatPos(
        this.verticalMode ? nodeRect.left : nodeRect.bottom,
        this.direction
      );
      const paragraphPos = nodeLeft - scrollElRight + scrollPos;
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

  calcExploredCharCount() {
    return this.getCharCountByScrollPos(this.scrollPos);
  }

  getCharCountByScrollPos(scrollPos: number) {
    const index = binarySearchNoNegative(this.paragraphPos, scrollPos);
    return this.paragraphPosToAccCharCount.get(this.paragraphPos[index]) || 0;
  }

  getScrollPosByCharCount(charCount: number) {
    const index = binarySearchNoNegative(this.accumulatedCharCount, charCount);
    return formatPos(this.paragraphPos[index], this.direction);
  }

  getNodeBoundingRect(node: Node) {
    const range = this.document.createRange();
    range.selectNode(node);
    return range.getBoundingClientRect();
  }

  private get scrollPos() {
    return formatPos(this.scrollEl[this.scrollPosProp], this.direction);
  }

  private get scrollPosProp() {
    return this.verticalMode ? 'scrollLeft' : 'scrollTop';
  }
}
