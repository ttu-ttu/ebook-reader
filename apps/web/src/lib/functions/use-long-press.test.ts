/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { longPress } from './use-long-press';

function pointer(type: string, x = 0) {
  // jsdom has no PointerEvent; a MouseEvent carries button and coordinates.
  return new MouseEvent(type, { button: 0, clientX: x, clientY: 0, bubbles: true });
}

describe('longPress', () => {
  afterEach(() => vi.useRealTimers());

  it('fires after holding and swallows the following click', () => {
    vi.useFakeTimers();
    const button = document.createElement('button');
    const listener = vi.fn();
    const click = vi.fn();

    button.addEventListener('click', click);
    longPress(button, listener);

    button.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(500);
    button.dispatchEvent(pointer('pointerup'));
    button.click();

    expect(listener).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
  });

  it('ignores short taps and presses that move', () => {
    vi.useFakeTimers();
    const button = document.createElement('button');
    const listener = vi.fn();
    const click = vi.fn();

    button.addEventListener('click', click);
    longPress(button, listener);

    button.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(200);
    button.dispatchEvent(pointer('pointerup'));
    button.click();
    button.dispatchEvent(pointer('pointerdown'));
    button.dispatchEvent(pointer('pointermove', 30));
    vi.advanceTimersByTime(600);

    expect(listener).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
  });
});
