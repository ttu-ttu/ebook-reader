/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { cueAt, matchableText, matchCues, parseSubtitles } from './subtitles';

describe('parseSubtitles', () => {
  it('reads SRT and VTT cues', () => {
    const srt =
      '1\r\n00:00:01,500 --> 00:00:03,000\r\n吾輩は猫である。\r\n\r\n2\r\n00:00:03,000 --> 00:01:04,250\r\n<i>名前は</i>\r\nまだ無い。\r\n';
    const vtt =
      'WEBVTT\n\n00:01.000 --> 00:02.000\nこんにちは\n\nNOTE skipped\n\n1:00:00.000 --> 1:00:01.000\n{\\an8}さようなら';

    expect(parseSubtitles(srt)).toEqual([
      { startSeconds: 1.5, endSeconds: 3, text: '吾輩は猫である。' },
      { startSeconds: 3, endSeconds: 64.25, text: '名前は まだ無い。' }
    ]);
    expect(parseSubtitles(vtt)).toEqual([
      { startSeconds: 1, endSeconds: 2, text: 'こんにちは' },
      { startSeconds: 3600, endSeconds: 3601, text: 'さようなら' }
    ]);
  });
});

describe('matchCues', () => {
  const book = matchableText(
    '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。'
  );
  const cue = (text: string, startSeconds: number) => ({
    text,
    startSeconds,
    endSeconds: startSeconds + 1
  });

  it('finds exact and slightly wrong lines in order', () => {
    const matched = matchCues(
      [
        cue('吾輩は猫である', 0),
        cue('名前はまだない', 1), // kana instead of 無
        cue('どこで生まれたかとんと見当がつかぬ', 2), // extra okurigana
        cue('全然関係ない文章です', 3),
        cue('何でも薄暗いじめじめした所でにゃーにゃー泣いていた', 4)
      ],
      book
    );

    expect(matched.map((m) => [m.start, m.end])).toEqual([
      [0, 7],
      [7, 14],
      [14, 30],
      [30, 30],
      [30, 55]
    ]);
    expect(book.slice(matched[4].start, matched[4].start! + 4)).toBe('何でも薄');
  });

  it('starts from the given position', () => {
    const matched = matchCues([cue('名前はまだ無い', 0)], book, 3);

    expect(matched[0].start).toBe(7);
    expect(matchCues([cue('吾輩は猫', 0)], book, 3)[0].start).toBeUndefined();
  });
});

describe('cueAt', () => {
  it('finds the last cue started', () => {
    const cues = [0, 2, 5].map((startSeconds) => ({ startSeconds, endSeconds: 0, text: '' }));

    expect([cueAt(cues, -1), cueAt(cues, 0), cueAt(cues, 4.9), cueAt(cues, 9)]).toEqual([
      -1, 0, 1, 2
    ]);
  });
});
