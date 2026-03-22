/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRangeForUserSelectionInContainer, isRangeInsideContainer } from './range-util';

describe('range-util selection scoping', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('keeps user selection when it is inside the reader container', () => {
    document.body.innerHTML = `
      <div class="book-content">
        <p><span id="inside">inside token</span></p>
      </div>
      <div id="panel"><p><span id="outside">outside token</span></p></div>
    `;

    const range = document.createRange();
    range.selectNodeContents(document.getElementById('inside') as HTMLElement);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'inside token',
      getRangeAt: () => range
    } as unknown as Selection);

    const container = document.querySelector('.book-content') as HTMLElement;
    const result = getRangeForUserSelectionInContainer(window, undefined, container);

    expect(result).toBeDefined();
    expect(isRangeInsideContainer(result as Range, container)).toBe(true);
  });

  it('drops user selection when it is outside the reader container', () => {
    document.body.innerHTML = `
      <div class="book-content">
        <p><span id="inside">inside token</span></p>
      </div>
      <div id="panel"><p><span id="outside">outside token</span></p></div>
    `;

    const range = document.createRange();
    range.selectNodeContents(document.getElementById('outside') as HTMLElement);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'outside token',
      getRangeAt: () => range
    } as unknown as Selection);

    const container = document.querySelector('.book-content') as HTMLElement;
    const result = getRangeForUserSelectionInContainer(window, undefined, container);

    expect(result).toBeUndefined();
  });

  it('drops stale preSelection that is outside the reader container', () => {
    document.body.innerHTML = `
      <div class="book-content">
        <p><span id="inside">inside token</span></p>
      </div>
      <div id="panel"><p><span id="outside">outside token</span></p></div>
    `;

    const staleRange = document.createRange();
    staleRange.selectNodeContents(document.getElementById('outside') as HTMLElement);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => '',
      getRangeAt: () => {
        throw new Error('should not be called when toString is empty');
      }
    } as unknown as Selection);

    const container = document.querySelector('.book-content') as HTMLElement;
    const result = getRangeForUserSelectionInContainer(window, staleRange, container);

    expect(result).toBeUndefined();
  });
});
