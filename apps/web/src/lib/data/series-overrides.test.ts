/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import {
  applySeriesOverride,
  findSeriesBooks,
  guessSeriesName,
  parseSeriesOverrides,
  saveSeriesOverrides,
  seriesForTitle
} from './series-overrides';

function card(title: string, series?: string): BookCardProps {
  return {
    id: 0,
    title,
    imagePath: '',
    characters: 0,
    lastBookModified: 0,
    lastBookOpen: 0,
    progress: 0,
    lastBookmarkModified: 0,
    isPlaceholder: false,
    series,
    seriesIndex: 1
  };
}

describe('guessSeriesName', () => {
  it.each([
    ['ソードアート・オンライン1 アインクラッド', 'ソードアート・オンライン'],
    ['とある魔術の禁書目録(3)', 'とある魔術の禁書目録'],
    ['ダンタリアンの書架１', 'ダンタリアンの書架'],
    ['狼と香辛料 第十二巻【電子特別版】', '狼と香辛料'],
    ['[著者] 本好きの下剋上 vol.2', '本好きの下剋上'],
    ['君の名は。', '君の名は。']
  ])('%s → %s', (title, name) => {
    expect(guessSeriesName(title)).toBe(name);
  });
});

describe('findSeriesBooks', () => {
  it('matches the name ignoring width, case and spaces', () => {
    const books = [card('ＳＡＯ　１'), card('sao 2'), card('別の本')];

    expect(findSeriesBooks(books, 'SAO').map((b) => b.title)).toEqual(['ＳＡＯ　１', 'sao 2']);
    expect(findSeriesBooks(books, ' ')).toEqual([]);
  });
});

describe('seriesForTitle', () => {
  it('picks the longest series named in the title', () => {
    const books = [card('a', '魔法'), card('b', '魔法科高校の劣等生'), card('c')];

    expect(seriesForTitle(books, '魔法科高校の劣等生 ５')).toBe('魔法科高校の劣等生');
    expect(seriesForTitle(books, '関係ない本')).toBe('');
  });
});

describe('parseSeriesOverrides and applySeriesOverride', () => {
  it('drops malformed entries', () => {
    expect(
      parseSeriesOverrides({
        ok: { series: ' S ', modified: 1 },
        bad: { series: 3, modified: 1 },
        long: { series: 'x'.repeat(201), modified: 1 }
      })
    ).toEqual({ ok: { series: 'S', modified: 1 } });
    expect(parseSeriesOverrides([1])).toEqual({});
  });

  it('sets or clears the series of a title', () => {
    const overrides = { a: { series: 'S', modified: 1 }, b: { series: '', modified: 1 } };

    expect(applySeriesOverride(card('a', 'Old'), overrides)).toMatchObject({
      series: 'S',
      seriesIndex: null
    });
    expect(applySeriesOverride(card('b', 'Old'), overrides).series).toBeUndefined();
    expect(applySeriesOverride(card('c', 'Old'), overrides).series).toBe('Old');
  });
});

describe('saveSeriesOverrides', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('merges changes into the latest server copy', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Response(null, { status: 201 })
        : new Response(JSON.stringify({ other: { series: 'X', modified: 1 } }))
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await saveSeriesOverrides({ mine: 'Y' });
    const put = fetchMock.mock.calls[1];

    expect(put[0]).toBe('/calibre/sync/series.json');
    expect(Object.keys(JSON.parse(put[1]!.body as string))).toEqual(['other', 'mine']);
    expect(result.mine.series).toBe('Y');
  });
});
