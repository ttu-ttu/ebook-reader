/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { kanjiCoverage, recordKanjiText, type KanjiSeen } from '$lib/data/kanji-seen';
import { readerDb } from '$lib/data/reader-db';

describe('kanjiCoverage', () => {
  it('weights kanji by how often the book uses them', () => {
    const seen: KanjiSeen[] = [
      { title: 'A', upTo: 10, counts: { 人: 3 } },
      { title: 'B', upTo: 10, counts: { 本: 1 } }
    ];

    expect(kanjiCoverage({ 人: 6, 本: 2, 鬱: 2 }, seen)).toEqual({ coverage: 0.8, newKanji: 1 });
  });

  it('has no coverage for a book without kanji', () => {
    expect(kanjiCoverage({}, [])).toBeUndefined();
  });
});

describe('recordKanjiText', () => {
  it('adds the kanji of each piece of text read', async () => {
    await recordKanjiText('ノベル', '吾輩は猫', 4);
    await recordKanjiText('ノベル', '猫である', 8);

    expect(await (await readerDb()).get('kanji', 'ノベル')).toEqual({
      title: 'ノベル',
      upTo: 8,
      counts: { 吾: 1, 輩: 1, 猫: 2 }
    });
  });
});
