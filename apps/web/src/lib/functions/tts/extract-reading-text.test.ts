/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  buildReadingChunks,
  displayReadingText,
  extractParagraphsFrom,
  speechText
} from './extract-reading-text';

describe('extractParagraphsFrom', () => {
  it('starts with the paragraph containing the position and drops furigana', () => {
    const html = '<p>一つ目。</p><p><ruby>二<rt>に</rt></ruby>つ目。</p><p>三つ目。</p>';

    expect(extractParagraphsFrom(html, 4)).toEqual([
      { text: '二つ目。', startCharCount: 3 },
      { text: '三つ目。', startCharCount: 6 }
    ]);
  });
});

describe('katakana readings', () => {
  it('are spoken instead of their base text without changing counts', () => {
    const html =
      '<p>一。</p><p><ruby>魔法<rt>マジック</rt></ruby>と<ruby>東<rt>ひがし</rt></ruby>と<ruby>未<rt>ミ</rt>来<rt>ライ</rt></ruby>。</p>';
    const [paragraph] = extractParagraphsFrom(html, 1);

    expect(paragraph.startCharCount).toBe(1);
    expect(speechText(paragraph.text)).toBe('マジックと東とミライ。');
    expect(displayReadingText(paragraph.text)).toBe('魔法と東と未来。');
    expect(buildReadingChunks([paragraph, { text: '次。', startCharCount: 7 }])[0].text).toBe(
      `${paragraph.text}\n次。`
    );
  });
});

describe('buildReadingChunks', () => {
  it('merges short paragraphs', () => {
    expect(
      buildReadingChunks([
        { text: 'あ。', startCharCount: 0 },
        { text: 'い。', startCharCount: 1 }
      ])
    ).toEqual([{ text: 'あ。\nい。', startCharCount: 0 }]);
  });

  it('splits long paragraphs at sentence ends', () => {
    const sentence = `${'あ'.repeat(499)}。`;
    const chunks = buildReadingChunks([{ text: sentence.repeat(3), startCharCount: 100 }]);

    expect(chunks.map((c) => c.text)).toEqual([sentence, sentence, sentence]);
  });

  it('gives chunks split from a paragraph their own start position', () => {
    // 499 counted characters per sentence; 。 is not counted.
    const sentence = `${'あ'.repeat(499)}。`;
    const chunks = buildReadingChunks([{ text: sentence.repeat(3), startCharCount: 100 }]);

    expect(chunks.map((c) => c.startCharCount)).toEqual([100, 599, 1098]);
  });
});
