/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  countCharacters,
  countsForRange,
  getTextSegments,
  offsetForCount,
  rangeForCounts
} from './text-positions';

function content(html: string) {
  const div = document.createElement('div');

  div.innerHTML = html;
  document.body.replaceChildren(div);

  return div;
}

describe('offsetForCount', () => {
  it('skips uncounted characters such as punctuation', () => {
    // 「 is not counted; あいう are.
    expect(offsetForCount('「あいう」', 0)).toBe(1);
    expect(offsetForCount('「あいう」', 2)).toBe(3);
    expect(offsetForCount('「あいう」', 2, true)).toBe(3);
    expect(offsetForCount('「あいう」', 3, true)).toBe(4);
  });

  it('treats surrogate pairs as one character', () => {
    expect(countCharacters('𠮟る')).toBe(2);
    expect(offsetForCount('𠮟る', 1)).toBe(2);
  });
});

describe('rangeForCounts / countsForRange', () => {
  it('round-trips across text nodes and skips furigana', () => {
    const root = content('<p>今日は<ruby>漢字<rt>かんじ</rt></ruby>を読む。</p><p>次の段落</p>');
    const segments = getTextSegments(root);
    // 今日は漢字を読む = 8, 次の段落 = 4
    expect(segments.reduce((sum, s) => sum + s.count, 0)).toBe(12);

    const range = rangeForCounts(document, segments, 3, 5)!;

    expect(range.toString()).toBe('漢字');
    expect(countsForRange(segments, range)).toEqual({ start: 3, end: 5 });
  });

  it('applies the base count of the rendered section', () => {
    const root = content('<p>あいうえお</p>');
    const segments = getTextSegments(root);
    const range = rangeForCounts(document, segments, 101, 103, 100)!;

    expect(range.toString()).toBe('いう');
    expect(countsForRange(segments, range, 100)).toEqual({ start: 101, end: 103 });
  });

  it('returns undefined outside the rendered text', () => {
    const segments = getTextSegments(content('<p>あいう</p>'));

    expect(rangeForCounts(document, segments, 10, 12)).toBeUndefined();
  });
});
