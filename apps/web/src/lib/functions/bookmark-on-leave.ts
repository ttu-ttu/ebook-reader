/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Whether leaving the reader should save the current position as the bookmark.
 * A saved bookmark that is still on screen is kept: it may point mid-page (a
 * selection, the reading point, a search or highlight jump), and saving would
 * move it to the start of the page or screen. Not part of upstream.
 */
export function shouldBookmarkOnLeave(
  manualBookmark: boolean,
  savedCount: number | undefined,
  isOnScreen: (charCount: number) => boolean
) {
  return !manualBookmark && !(savedCount && isOnScreen(savedCount));
}
