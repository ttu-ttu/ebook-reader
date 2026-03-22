/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookmarkManager } from '../types';
import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
import type { CharacterStatsCalculator } from './character-stats-calculator';

export class BookmarkManagerContinuous implements BookmarkManager {
  private readonly maxScrollToBookmarkAttempts = 20;

  private readonly scrollToBookmarkRetryDelayMs = 25;

  constructor(
    private calculator: CharacterStatsCalculator,
    private window: Window,
    private firstDimensionMargin: number
  ) {}

  scrollToBookmark(bookmarkData: BooksDbBookmarkData, customReadingPointScrollOffset = 0) {
    void customReadingPointScrollOffset;
    this.scrollToBookmarkByAnchorPath(bookmarkData.anchorPath, 0);
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
      anchorPath: this.captureBookmarkAnchorPath(customReadingPointScrollOffset),
      [scrollAxis]: this.window[scrollAxis],
      lastBookmarkModified: new Date().getTime()
    };
  }

  formatBookmarkDataByRange(
    bookId: number,
    customReadingPointRange: Range | undefined
  ): BooksDbBookmarkData {
    if (!customReadingPointRange) {
      return this.formatBookmarkData(bookId);
    }

    const bookCharCount = this.calculator.charCount;
    const exploredCharCount = this.calculator.getCharCountToPoint(customReadingPointRange);
    const { verticalMode } = this.calculator;
    const scrollAxis = verticalMode ? 'scrollX' : 'scrollY';

    return {
      dataId: bookId,
      exploredCharCount,
      progress: exploredCharCount / bookCharCount,
      anchorPath: this.captureBookmarkAnchorPathFromRange(customReadingPointRange),
      [scrollAxis]: this.window[scrollAxis],
      lastBookmarkModified: new Date().getTime()
    };
  }

  getBookmarkBarPosition(bookmarkData: BooksDbBookmarkData): BookmarkPosData | undefined {
    const anchorElement = this.resolveBookmarkAnchor(bookmarkData.anchorPath);
    if (!anchorElement) {
      return undefined;
    }

    const rect = anchorElement.getBoundingClientRect();
    if (this.calculator.verticalMode) {
      const absoluteRight = rect.right + this.window.scrollX;
      const right = this.window.innerWidth - absoluteRight + this.firstDimensionMargin;
      return {
        right: `${Math.max(0, right)}px`
      };
    }

    const absoluteTop = rect.top + this.window.scrollY;
    return {
      top: `${Math.max(0, absoluteTop + this.firstDimensionMargin)}px`
    };
  }

  private captureBookmarkAnchorPath(customReadingPointScrollOffset: number): string | undefined {
    const container = this.calculator.containerEl;
    const containerRect = container.getBoundingClientRect();
    const { verticalMode } = this.calculator;
    const preferredAnchorX = verticalMode
      ? clampPoint(
          this.window.innerWidth - this.firstDimensionMargin - customReadingPointScrollOffset - 2,
          this.window.innerWidth
        )
      : clampPoint(this.window.innerWidth / 2, this.window.innerWidth);
    const preferredAnchorY = verticalMode
      ? clampPoint(this.window.innerHeight / 2, this.window.innerHeight)
      : clampPoint(
          this.firstDimensionMargin + customReadingPointScrollOffset + 2,
          this.window.innerHeight
        );

    const visibleLeft = Math.max(0, containerRect.left);
    const visibleRight = Math.min(this.window.innerWidth - 1, containerRect.right);
    const visibleTop = Math.max(0, containerRect.top);
    const visibleBottom = Math.min(this.window.innerHeight - 1, containerRect.bottom);
    const fallbackAnchorX = clampPoint(
      visibleRight >= visibleLeft ? (visibleLeft + visibleRight) / 2 : this.window.innerWidth / 2,
      this.window.innerWidth
    );
    const fallbackAnchorY = clampPoint(
      visibleBottom >= visibleTop ? (visibleTop + visibleBottom) / 2 : this.window.innerHeight / 2,
      this.window.innerHeight
    );

    const target =
      this.getContainerElementFromPoint(container, preferredAnchorX, preferredAnchorY) ||
      this.getContainerElementFromPoint(container, fallbackAnchorX, fallbackAnchorY);
    const fallbackVisibleAnchor = this.findVisibleAnchor(container);
    if (!target && !fallbackVisibleAnchor) {
      return undefined;
    }

    const anchorElement = this.pickAnchorElement(container, target || fallbackVisibleAnchor);
    if (!container.contains(anchorElement)) {
      return undefined;
    }

    return this.getAnchorPath(anchorElement);
  }

  private captureBookmarkAnchorPathFromRange(range: Range): string | undefined {
    const container = this.calculator.containerEl;
    const startNode = range.startContainer;
    const startElement =
      startNode instanceof HTMLElement
        ? startNode
        : (startNode.parentElement as HTMLElement | null);

    if (!startElement || !container.contains(startElement)) {
      return undefined;
    }

    const anchorElement = this.pickAnchorElement(container, startElement);
    if (!container.contains(anchorElement)) {
      return undefined;
    }

    return this.getAnchorPath(anchorElement);
  }

  private getContainerElementFromPoint(
    container: HTMLElement,
    x: number,
    y: number
  ): HTMLElement | undefined {
    // Prefer deepest rendered element at point, excluding the root container itself.
    const pointElements = this.window.document.elementsFromPoint(x, y);
    const pointMatch = pointElements.find(
      (element) =>
        element instanceof HTMLElement && element !== container && container.contains(element)
    );
    if (pointMatch && pointMatch instanceof HTMLElement) {
      return pointMatch;
    }

    // Fallback to caret position APIs when point lookup lands on overlays/background.
    const caretMatch = this.getCaretElementFromPoint(x, y);
    if (caretMatch && caretMatch !== container && container.contains(caretMatch)) {
      return caretMatch;
    }

    return undefined;
  }

  private getCaretElementFromPoint(x: number, y: number): HTMLElement | undefined {
    const documentWithCaretPosition = this.window.document as Document & {
      caretPositionFromPoint?: (px: number, py: number) => { offsetNode: Node | null } | null;
      caretRangeFromPoint?: (px: number, py: number) => Range | null;
    };

    const caretPosition = documentWithCaretPosition.caretPositionFromPoint?.(x, y);
    const caretNode =
      caretPosition?.offsetNode ||
      documentWithCaretPosition.caretRangeFromPoint?.(x, y)?.startContainer;
    if (!caretNode) {
      return undefined;
    }

    if (caretNode instanceof HTMLElement) {
      return caretNode;
    }

    return caretNode.parentElement || undefined;
  }

  private pickAnchorElement(container: HTMLElement, target: HTMLElement): HTMLElement {
    const semanticAnchor = target.closest<HTMLElement>(
      'p, section, article, li, blockquote, h1, h2, h3, h4, h5, h6'
    );
    if (semanticAnchor && semanticAnchor !== container && container.contains(semanticAnchor)) {
      return semanticAnchor;
    }

    let current: HTMLElement | null = target;
    while (current && current !== container) {
      if ((current.textContent || '').trim().length > 0) {
        return current;
      }
      current = current.parentElement;
    }

    return target;
  }

  private findVisibleAnchor(container: HTMLElement): HTMLElement | undefined {
    const candidates = container.querySelectorAll<HTMLElement>(
      'p, section, article, li, blockquote, h1, h2, h3, h4, h5, h6, div'
    );
    const viewportCenterX = this.window.innerWidth / 2;
    const viewportCenterY = this.window.innerHeight / 2;
    let bestCandidate: HTMLElement | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const text = (candidate.textContent || '').trim();
      if (!text) {
        continue;
      }

      const rect = candidate.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom < 0 ||
        rect.top > this.window.innerHeight ||
        rect.right < 0 ||
        rect.left > this.window.innerWidth
      ) {
        continue;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const score = Math.abs(centerX - viewportCenterX) + Math.abs(centerY - viewportCenterY);
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  private resolveBookmarkAnchor(anchorPath: string | undefined): HTMLElement | undefined {
    if (!anchorPath) {
      return undefined;
    }

    const indices = anchorPath
      .split('.')
      .map((segment) => Number(segment))
      .filter((segment) => Number.isInteger(segment) && segment >= 0);
    if (!indices.length) {
      return undefined;
    }

    let current: Element = this.calculator.containerEl;
    for (const index of indices) {
      const next = current.children.item(index);
      if (!next) {
        return undefined;
      }
      current = next;
    }

    return current instanceof HTMLElement ? current : undefined;
  }

  private scrollToBookmarkByAnchorPath(anchorPath: string | undefined, attempt: number): void {
    const anchorElement = this.resolveBookmarkAnchor(anchorPath);
    if (anchorElement) {
      anchorElement.scrollIntoView({
        behavior: 'auto',
        block: 'start',
        inline: 'start'
      });
      return;
    }

    if (!anchorPath || attempt >= this.maxScrollToBookmarkAttempts - 1) {
      return;
    }

    this.window.setTimeout(() => {
      this.scrollToBookmarkByAnchorPath(anchorPath, attempt + 1);
    }, this.scrollToBookmarkRetryDelayMs);
  }

  private getAnchorPath(anchorElement: HTMLElement): string | undefined {
    const root = this.calculator.containerEl;
    const segments: number[] = [];

    let current: Element | null = anchorElement;
    while (current && current !== root) {
      const parent = current.parentElement;
      if (!parent) {
        return undefined;
      }

      const index = Array.from(parent.children).indexOf(current);
      if (index < 0) {
        return undefined;
      }

      segments.push(index);
      current = parent;
    }

    if (current !== root || !segments.length) {
      return undefined;
    }

    return segments.reverse().join('.');
  }
}

function clampPoint(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.floor(value), 0), Math.max(max - 1, 0));
}

export interface BookmarkPosData {
  top?: string;
  right?: string;
}
