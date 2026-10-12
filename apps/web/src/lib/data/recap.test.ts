/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRouterApiKey$, openRouterModel$, openRouterRecapModel$ } from '$lib/data/ai-settings';
import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';
import { buildSearchIndex } from '$lib/functions/book-text/book-search';
import { readerDb } from '$lib/data/reader-db';
import { getSavedRecaps, planRecap, textBetween, writeRecap } from './recap';

const sections = [
  { reference: 'c1', label: 'One', startCharacter: 0 },
  { reference: 'c2', label: 'Two', startCharacter: 3 },
  { reference: 'c3', label: 'Three', startCharacter: 6 }
] as Section[];
const index = buildSearchIndex('<p>あいう</p><p>えおか</p><p>きくけ</p>');

async function cacheSummary(title: string, key: string, model: string) {
  await (
    await readerDb()
  ).put('recaps', { title, chapters: { [key]: { summary: 's', characters: 3, model } } });
}

describe('planRecap', () => {
  it('summarises only finished chapters, skipping cached ones for the same model', async () => {
    openRouterModel$.next('model/a');
    openRouterRecapModel$.next('');
    await cacheSummary('Book', 'c1', 'model/a');

    const plan = await planRecap('Book', index, sections, 7, 9);

    expect(plan.finished.map((p) => p.key)).toEqual(['c1', 'c2']);
    expect(plan.missing.map((p) => p.key)).toEqual(['c2']);
    expect(plan.missingCharacters).toBe(3);
    expect(plan.model).toBe('model/a');
  });

  it('redoes summaries made with another model', async () => {
    openRouterRecapModel$.next('model/cheap');
    await cacheSummary('Book 2', 'c1', 'model/a');

    const plan = await planRecap('Book 2', index, sections, 7, 9);

    expect(plan.missing.map((p) => p.key)).toEqual(['c1', 'c2']);
  });
});

describe('writeRecap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    openRouterApiKey$.next('');
  });

  it('saves each recap with the position it covers', async () => {
    openRouterApiKey$.next('sk-or-test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('data: {"choices":[{"delta":{"content":"Recap"}}]}\n'))
    );

    const plan = await planRecap('Saved', index, sections, 2, 9);

    await writeRecap(
      'Saved',
      index,
      plan,
      2,
      () => {},
      () => {},
      new AbortController().signal
    );
    await writeRecap(
      'Saved',
      index,
      plan,
      1,
      () => {},
      () => {},
      new AbortController().signal
    );

    expect((await getSavedRecaps('Saved')).map((r) => [r.position, r.text])).toEqual([
      [1, 'Recap'],
      [2, 'Recap']
    ]);
  });
});

describe('textBetween', () => {
  it('cuts the paragraph containing the start instead of skipping it', () => {
    const text = buildSearchIndex('<p>「あいうえお」</p><p>かき</p>');

    expect(textBetween(text, 2, 6)).toBe('うえお」\nか');
    expect(textBetween(text, 0, 2)).toBe('「あい');
  });
});
