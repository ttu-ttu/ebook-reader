/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { kanjiCoverage, type KanjiSeen } from '$lib/data/kanji-seen';

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
