/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { shouldBookmarkOnLeave } from './bookmark-on-leave';

describe('shouldBookmarkOnLeave', () => {
  const onScreen = (from: number, to: number) => (count: number) => count >= from && count <= to;

  it('keeps a mid-page bookmark that is still on screen', () => {
    expect(shouldBookmarkOnLeave(false, 1250, onScreen(1000, 1500))).toBe(false);
  });

  it('saves the new position after reading on, or without a bookmark', () => {
    expect(shouldBookmarkOnLeave(false, 1250, onScreen(1600, 2100))).toBe(true);
    expect(shouldBookmarkOnLeave(false, undefined, onScreen(0, 500))).toBe(true);
    expect(shouldBookmarkOnLeave(false, 0, onScreen(0, 500))).toBe(true);
  });

  it('never saves with manual bookmarks', () => {
    expect(shouldBookmarkOnLeave(true, 1250, onScreen(1600, 2100))).toBe(false);
  });
});
