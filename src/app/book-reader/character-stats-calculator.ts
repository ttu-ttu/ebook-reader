/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import binarySearch from '../utils/binary-search';
import formatScrollPos from '../utils/format-scroll-pos';
import getCharacterCount from '../utils/get-character-count';
import isElementGaiji from '../utils/is-element-gaiji';

export default class CharacterStatsCalculator {
  readonly charCount: number;

  private readonly paragraphs: Node[];

  private readonly paragraphPos: number[];

  private paragraphPosToAccCharCount = new Map<number, number>();

  private readonly accumulatedCharCount: number[];

  constructor(
    public readonly containerEl: HTMLElement,
    private verticalMode: boolean,
    private readonly scrollEl: HTMLElement,
    private readonly document: Document
  ) {
    this.paragraphs = getTextNodeOrGaijiNodes(containerEl, (n) => {
      if (n.nodeName === 'RT') {
        return false;
      }
      const isHidden =
        n instanceof HTMLElement &&
        (n.attributes.getNamedItem('aria-hidden') ||
          n.attributes.getNamedItem('hidden'));
      if (isHidden) {
        return false;
      }
      return true;
    }).filter((n) => {
      if (isNodeGaiji(n)) {
        return true;
      }
      if (n.textContent?.replace(/\s/g, '').length) {
        return true;
      }
      return false;
    });

    this.paragraphPos = Array(this.paragraphs.length);
    this.accumulatedCharCount = [];
    let exploredCharCount = 0;
    for (const node of this.paragraphs) {
      exploredCharCount += isNodeGaiji(node) ? 1 : getCharacterCount(node);
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

    const paragraphPosToIndices = new Map<number, number[]>();
    for (let i = 0; i < this.paragraphs.length; i += 1) {
      const node = this.paragraphs[i];

      const nodeRect = this.getNodeBoundingRect(node);
      const nodeLeft = this.verticalMode ? -nodeRect.left : nodeRect.bottom;
      const paragraphPos = nodeLeft - scrollElRight;
      this.paragraphPos[i] = paragraphPos;

      const indices = paragraphPosToIndices.get(paragraphPos) || [];
      paragraphPosToIndices.set(paragraphPos, indices);
      indices.push(i);
    }

    this.paragraphPosToAccCharCount = new Map(
      Array.from(paragraphPosToIndices.entries()).map(
        ([paragraphPos, indices]) => [
          paragraphPos,
          Math.max(...indices.map((i) => this.accumulatedCharCount[i])),
        ]
      )
    );
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
    return this.paragraphPosToAccCharCount.get(this.paragraphPos[index]) || 0;
  }

  getScrollPosByCharCount(charCount: number) {
    const index = binarySearch(this.accumulatedCharCount, charCount, true);
    return formatScrollPos(this.paragraphPos[index], this.verticalMode);
  }

  getNodeBoundingRect(node: Node) {
    const range = this.document.createRange();
    range.selectNode(node);
    return range.getBoundingClientRect();
  }
}

function getTextNodeOrGaijiNodes(
  node: Node,
  filterFn: (n: Node) => boolean
): Node[] {
  if (!node.hasChildNodes() || !filterFn(node)) {
    return [];
  }

  return Array.from(node.childNodes)
    .flatMap((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        return [n];
      }
      if (isNodeGaiji(n)) {
        return [n];
      }
      return getTextNodeOrGaijiNodes(n, filterFn);
    })
    .filter(filterFn);
}

function isNodeGaiji(node: Node) {
  if (!(node instanceof HTMLImageElement)) {
    return false;
  }
  return isElementGaiji(node);
}
