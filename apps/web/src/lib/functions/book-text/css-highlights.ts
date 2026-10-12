/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Named highlights through the CSS Custom Highlight API, which colours ranges
 * without touching the book's DOM (character counting and pagination depend on
 * it). Styled in app.scss with ::highlight(name). Not part of upstream.
 */

export const cssHighlightsSupported =
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

export function setCssHighlight(name: string, ranges: Range[]) {
  if (!cssHighlightsSupported) {
    return;
  }

  if (ranges.length) {
    CSS.highlights.set(name, new Highlight(...ranges));
  } else {
    CSS.highlights.delete(name);
  }
}

export function clearCssHighlights(prefix: string) {
  if (!cssHighlightsSupported) {
    return;
  }

  [...CSS.highlights.keys()]
    .filter((name) => name.startsWith(prefix))
    .forEach((name) => CSS.highlights.delete(name));
}
