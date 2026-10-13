/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { absMatchKey, absSameBook, candidatesFromItem } from './audiobookshelf';

const file = (ino: string, index: number, filename: string, duration = 10) => ({
  ino,
  index,
  duration,
  metadata: { filename }
});

describe('candidatesFromItem', () => {
  it('plays an item of chapters as one book, tracks in order', () => {
    const [candidate] = candidatesFromItem('黒田如水', {
      id: 'a',
      media: {
        metadata: { title: '黒田如水' },
        audioFiles: [file('2', 2, '02.mp3', 5), file('1', 1, '01.mp3', 7)]
      }
    });

    expect(candidate.wholeItem).toBe(true);
    expect(candidate.tracks).toEqual([
      { ino: '1', startOffset: 0, duration: 7 },
      { ino: '2', startOffset: 7, duration: 5 }
    ]);
  });

  it('picks the files named like the book from a folder of several books', () => {
    const candidates = candidatesFromItem('ムゲンのi 上', {
      id: 'b',
      media: {
        metadata: { title: 'むらさきのスカートの女' },
        audioFiles: [
          file('1', 1, 'むらさきのスカートの女.m4b'),
          file('2', 2, 'ムゲンのｉ ： 上 [B09WZ8TDXC].m4b'),
          file('3', 3, 'ムゲンのｉ ： 下 [B09WZ3KQ3F].m4b')
        ]
      }
    });

    expect(candidates.map((c) => [c.label, c.wholeItem])).toEqual([
      ['ムゲンのｉ ： 上 [B09WZ8TDXC].m4b', false]
    ]);
  });

  it('finds a volume in an item of several volumes, with its subtitles', () => {
    const [candidate] = candidatesFromItem('無職転生 ～異世界行ったら本気だす～ 16 (MFブックス)', {
      id: 'c',
      media: {
        metadata: { title: '[15巻] 無職転生 ～異世界行ったら本気だす～ 15' },
        audioFiles: [
          file('15', 1, '[15] 無職転生 ～異世界行ったら本気だす～ 15 [B0D4LHH8CG].m4b'),
          file('16', 2, '[16] 無職転生 ～異世界行ったら本気だす～ 16 [B0D4M1GTZZ].m4b')
        ]
      },
      libraryFiles: [
        {
          ino: 's15',
          metadata: {
            filename: '[15] 無職転生 ～異世界行ったら本気だす～ 15 [B0D4LHH8CG].srt',
            ext: '.srt'
          }
        },
        {
          ino: 's16',
          metadata: {
            filename: '[16] 無職転生 ～異世界行ったら本気だす～ 16 [B0D4M1GTZZ].srt',
            ext: '.srt'
          }
        }
      ]
    });

    expect(candidate).toMatchObject({
      tracks: [{ ino: '16' }],
      subtitles: ['s16'],
      wholeItem: false
    });
  });

  it('leaves out items of another book', () => {
    expect(
      candidatesFromItem('人間失格', {
        id: 'd',
        media: { metadata: { title: '走れメロス' }, audioFiles: [file('1', 1, '走れメロス.m4b')] }
      })
    ).toEqual([]);
  });
});

describe('absSameBook', () => {
  it('matches across tags, dashes and the volume number', () => {
    const title = '無職転生〜異世界行ったら本気だす3';

    expect(absSameBook(title, '[3巻] 無職転生 ～異世界行ったら本気だす～ 3')).toBe(true);
    expect(absSameBook(title, '[13巻] 無職転生 ～異世界行ったら本気だす～ 13')).toBe(false);
    expect(absSameBook(title, '[1巻] 無職転生 ～蛇足編～1')).toBe(false);
    expect(absSameBook('人間失格', '人間失格')).toBe(true);
    expect(absSameBook('X 1 (MFブックス)', '[1巻] X 1')).toBe(true);
    expect(absSameBook('X 1', '[27] X スペシャルブック')).toBe(false);
    expect(absSameBook('X 転移迷宮編', '[1巻] X 1')).toBe(false);
  });
});

describe('absMatchKey', () => {
  it('ignores width, case, spaces and punctuation', () => {
    expect(absMatchKey('ムゲンのｉ ： 上')).toBe(absMatchKey('ムゲンのI上'));
  });
});
