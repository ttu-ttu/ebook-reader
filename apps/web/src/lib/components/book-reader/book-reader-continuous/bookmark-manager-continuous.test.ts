/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkManagerContinuous } from './bookmark-manager-continuous';

function defineWindowScroll(x: number, y: number) {
  Object.defineProperty(window, 'scrollX', { value: x, writable: true, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
}

function createDom() {
  document.body.innerHTML = `
    <div id="root">
      <section>
        <p>alpha</p>
        <p id="target"><span id="token">beta</span></p>
      </section>
    </div>
  `;

  const containerEl = document.getElementById('root') as HTMLElement;
  const targetEl = document.getElementById('target') as HTMLElement;
  const tokenTextNode = document.getElementById('token')?.firstChild as Text;

  return { containerEl, targetEl, tokenTextNode };
}

function createCalculator(containerEl: HTMLElement, options?: { verticalMode?: boolean }) {
  return {
    containerEl,
    charCount: 1000,
    verticalMode: options?.verticalMode ?? false,
    calcExploredCharCount: vi.fn().mockReturnValue(120),
    getCharCountToPoint: vi.fn().mockReturnValue(300)
  } as any;
}

describe('BookmarkManagerContinuous', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    defineWindowScroll(0, 0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores selection-based bookmark using range start anchor path', () => {
    const { containerEl, tokenTextNode } = createDom();
    const calculator = createCalculator(containerEl);
    const manager = new BookmarkManagerContinuous(calculator, window, 12);
    const range = document.createRange();
    range.setStart(tokenTextNode, 0);
    range.setEnd(tokenTextNode, tokenTextNode.textContent?.length || 0);
    defineWindowScroll(0, 42);

    const data = manager.formatBookmarkDataByRange(7, range);

    expect(calculator.getCharCountToPoint).toHaveBeenCalledWith(range);
    expect(data.dataId).toBe(7);
    expect(data.exploredCharCount).toBe(300);
    expect(data.progress).toBe(0.3);
    expect(data.anchorPath).toBe('0.1');
    expect(data.scrollY).toBe(42);
  });

  it('jumps to anchor with top alignment (block:start)', () => {
    const { containerEl, targetEl } = createDom();
    const calculator = createCalculator(containerEl);
    const manager = new BookmarkManagerContinuous(calculator, window, 12);
    const scrollIntoViewMock = vi.fn();
    targetEl.scrollIntoView = scrollIntoViewMock;

    manager.scrollToBookmark({ anchorPath: '0.1' } as any);

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
      inline: 'start'
    });
  });

  it('does nothing when bookmark anchor path is invalid', () => {
    const { containerEl, targetEl } = createDom();
    const calculator = createCalculator(containerEl);
    const manager = new BookmarkManagerContinuous(calculator, window, 12);
    const scrollIntoViewMock = vi.fn();
    targetEl.scrollIntoView = scrollIntoViewMock;

    manager.scrollToBookmark({ anchorPath: '0.999' } as any);

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('retries jumping until anchor path appears in DOM', () => {
    vi.useFakeTimers();

    const { containerEl } = createDom();
    const calculator = createCalculator(containerEl);
    const manager = new BookmarkManagerContinuous(calculator, window, 12);
    const sectionEl = containerEl.querySelector('section') as HTMLElement;
    const initialSecondChild = sectionEl.children.item(1);

    initialSecondChild?.remove();

    const lateAnchor = document.createElement('p');
    lateAnchor.textContent = 'late anchor';
    const scrollIntoViewMock = vi.fn();
    lateAnchor.scrollIntoView = scrollIntoViewMock;

    setTimeout(() => {
      sectionEl.appendChild(lateAnchor);
    }, 10);

    manager.scrollToBookmark({ anchorPath: '0.1' } as any);
    vi.advanceTimersByTime(50);

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
      inline: 'start'
    });
  });

  it('computes bookmark bar top from anchor position in non-vertical mode', () => {
    const { containerEl, targetEl } = createDom();
    const calculator = createCalculator(containerEl, { verticalMode: false });
    const manager = new BookmarkManagerContinuous(calculator, window, 8);
    defineWindowScroll(0, 300);
    targetEl.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 120,
      right: 0
    });

    const position = manager.getBookmarkBarPosition({ anchorPath: '0.1' } as any);

    expect(position).toEqual({ top: '428px' });
  });
});
