/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Mapping between character counts (as used for bookmarks, statistics and
 * "Jump to position") and positions in the book's DOM or text. Used by search
 * and highlights. Not part of upstream.
 */

import { getParagraphNodes } from '$lib/components/book-reader/get-paragraph-nodes';
import { getCharacterCount, isCountedCharacter } from '$lib/functions/get-character-count';
import { isNodeGaiji } from '$lib/functions/is-node-gaiji';

/** Text of a gaiji image (counted as one character), so offsets and counts stay in step. */
export const gaijiPlaceholder = '\uE000';

export interface TextSegment {
  node: Node;
  /** Character count before this node */
  startCount: number;
  count: number;
  text: string;
}

/**
 * Text nodes (and gaiji images) in the order and with the counts that character
 * counting uses, so segment counts add up to bookmark positions.
 */
export function getTextSegments(root: Node): TextSegment[] {
  const segments: TextSegment[] = [];
  let startCount = 0;

  getParagraphNodes(root).forEach((node) => {
    const count = getCharacterCount(node);

    segments.push({
      node,
      startCount,
      count,
      text: isNodeGaiji(node) ? gaijiPlaceholder : node.textContent || ''
    });
    startCount += count;
  });

  return segments;
}

function countsAsCharacter(char: string) {
  return char === gaijiPlaceholder || isCountedCharacter(char);
}

/** Counted characters in segment text (gaiji placeholders count as one). */
export function countCharacters(text: string) {
  return countBeforeOffset(text, text.length);
}

/**
 * String offset in `text` just before the counted character number `count + 1`
 * (or after the last counted character when `atEnd`).
 */
export function offsetForCount(text: string, count: number, atEnd = false) {
  let seen = 0;
  let offset = 0;

  for (const char of text) {
    const counted = countsAsCharacter(char);

    if (counted && seen === count && !atEnd) {
      return offset;
    }

    offset += char.length;

    if (counted) {
      seen += 1;

      if (atEnd && seen === count) {
        return offset;
      }
    }
  }

  return text.length;
}

export function countBeforeOffset(text: string, offset: number) {
  let seen = 0;
  let position = 0;

  for (const char of text) {
    if (position >= offset) {
      break;
    }
    if (countsAsCharacter(char)) {
      seen += 1;
    }
    position += char.length;
  }

  return seen;
}

function segmentIndexForCount(segments: TextSegment[], count: number, atEnd: boolean) {
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const segment = segments[middle];
    const segmentEnd = segment.startCount + segment.count;
    const inside = atEnd
      ? count > segment.startCount && count <= segmentEnd
      : count >= segment.startCount && count < segmentEnd;

    if (inside) {
      return middle;
    }
    if (count < segment.startCount || (atEnd && count === segment.startCount)) {
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }

  return -1;
}

/**
 * DOM range covering the characters from `start` (exclusive) to `end`
 * (inclusive) in absolute counts. `baseCount` is the count at the start of
 * `segments` (the current section in paginated mode).
 */
export function rangeForCounts(
  document: Document,
  segments: TextSegment[],
  start: number,
  end: number,
  baseCount = 0
): Range | undefined {
  const startIndex = segmentIndexForCount(segments, start - baseCount, false);
  const endIndex = segmentIndexForCount(segments, end - baseCount, true);

  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    return undefined;
  }

  const startSegment = segments[startIndex];
  const endSegment = segments[endIndex];
  const range = document.createRange();

  if (isNodeGaiji(startSegment.node)) {
    range.setStartBefore(startSegment.node);
  } else {
    range.setStart(
      startSegment.node,
      offsetForCount(startSegment.text, start - baseCount - startSegment.startCount)
    );
  }

  if (isNodeGaiji(endSegment.node)) {
    range.setEndAfter(endSegment.node);
  } else {
    range.setEnd(
      endSegment.node,
      offsetForCount(endSegment.text, end - baseCount - endSegment.startCount, true)
    );
  }

  return range;
}

/** Absolute character counts at the start and end of a range. */
export function countsForRange(segments: TextSegment[], range: Range, baseCount = 0) {
  const countAt = (container: Node, offset: number) => {
    const point = (container.ownerDocument || document).createRange();
    let count = 0;

    point.setStart(container, offset);

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];

      if (segment.node === container) {
        return segment.startCount + countBeforeOffset(segment.text, offset);
      }

      // Segment lies before the boundary point.
      if (point.comparePoint(segment.node, 0) < 0) {
        count = segment.startCount + segment.count;
      } else {
        return segment.startCount;
      }
    }

    return count;
  };

  return {
    start: baseCount + countAt(range.startContainer, range.startOffset),
    end: baseCount + countAt(range.endContainer, range.endOffset)
  };
}
