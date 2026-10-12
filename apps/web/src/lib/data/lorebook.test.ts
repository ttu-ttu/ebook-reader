/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRouterApiKey$ } from '$lib/data/ai-settings';
import { buildSearchIndex } from '$lib/functions/book-text/book-search';
import {
  copyLorebookTo,
  getLorebook,
  laterInSeries,
  isLorebookUpdating,
  lorebookProgress$,
  stopLorebookUpdate,
  mergeLoreEntries,
  parseLoreAnswer,
  toSillyTavern,
  updateLorebook,
  type LoreEntry
} from './lorebook';

function answer(json: unknown) {
  const content = JSON.stringify('```json\n' + JSON.stringify(json) + '\n```');

  return new Response(`data: {"choices":[{"delta":{"content":${content}}}]}\n\ndata: [DONE]\n`);
}

const aoi: LoreEntry = {
  id: 'a',
  name: '葵',
  reading: 'あおい',
  category: 'character',
  keys: ['葵'],
  content: 'A student.',
  firstSeen: 0,
  updated: 10
};

describe('mergeLoreEntries', () => {
  it('updates entries matched by name or key and adds new ones', () => {
    const merged = mergeLoreEntries(
      [aoi],
      [
        { name: '葵ちゃん', keys: ['葵'], content: 'A student who likes cats.' },
        { name: '東京', category: 'place', content: 'Where they live.' },
        { name: '', content: 'ignored' },
        { name: 'bad', category: 'nonsense' as never, content: 'Falls back to term.' }
      ],
      100,
      200
    );

    expect(merged[0]).toMatchObject({
      name: '葵',
      content: 'A student who likes cats.',
      updated: 200
    });
    expect(merged[1]).toMatchObject({
      name: '東京',
      category: 'place',
      firstSeen: 100,
      keys: ['東京']
    });
    expect(merged[2].category).toBe('term');
    expect(merged).toHaveLength(3);
  });
});

describe('parseLoreAnswer', () => {
  it('reads JSON inside code fences', () => {
    expect(parseLoreAnswer('Here:\n```json\n{"entries":[{"name":"x"}]}\n```')).toEqual([
      { name: 'x' }
    ]);
    expect(() => parseLoreAnswer('no json')).toThrow();
  });
});

describe('updateLorebook', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    openRouterApiKey$.next('');
  });

  it('only sends the text after the last update', async () => {
    openRouterApiKey$.next('sk-or-test');
    const index = buildSearchIndex('<p>葵は学生。</p><p>葵は猫が好き。</p>');
    const fetch = vi.fn(async () => answer({ entries: [{ name: '葵', content: 'Student.' }] }));

    vi.stubGlobal('fetch', fetch);

    await updateLorebook('Lore', index, 4);
    expect((await getLorebook('Lore')).processedUpTo).toBe(4);

    fetch.mockImplementation(async () =>
      answer({ entries: [{ name: '葵', content: 'Student who likes cats.' }] })
    );
    const lorebook = await updateLorebook('Lore', index, 10);
    const sent = (fetch.mock.calls as unknown as [string, RequestInit][]).map(
      ([, init]) => JSON.parse(init.body as string).messages[1].content as string
    );

    expect(sent[0]).toContain('葵は学生');
    expect(sent[0]).not.toContain('猫');
    expect(sent[1]).toContain('葵は猫が好き');
    expect(sent[1]).not.toContain('学生');
    expect(lorebook.entries).toHaveLength(1);
    expect(lorebook.entries[0]).toMatchObject({ content: 'Student who likes cats.', updated: 10 });
    expect(lorebook.processedUpTo).toBe(10);
  });
});

describe('stopLorebookUpdate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    openRouterApiKey$.next('');
  });

  it('stops a running update without losing saved progress or reporting an error', async () => {
    openRouterApiKey$.next('sk-or-test');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            const abort = () => reject(new DOMException('Aborted', 'AbortError'));

            if (init.signal?.aborted) {
              abort();
            }
            init.signal?.addEventListener('abort', abort);
          })
      )
    );

    const update = updateLorebook('Stop', buildSearchIndex('<p>猫が好き</p>'), 4);

    await vi.waitFor(() => expect(isLorebookUpdating('Stop')).toBe(true));
    stopLorebookUpdate('Stop');

    await expect(update).rejects.toThrow();
    expect(isLorebookUpdating('Stop')).toBe(false);
    expect((await getLorebook('Stop')).processedUpTo).toBe(0);
    expect(lorebookProgress$.getValue()).toEqual({ title: 'Stop', message: '', error: '' });
  });
});

describe('laterInSeries', () => {
  it('lists later volumes, next first, preferring books on Home', () => {
    const books = [
      { title: 'A1', series: 'A', seriesIndex: 1 },
      { title: 'A3', series: 'A', seriesIndex: 3 },
      { title: 'A2 (other edition)', series: 'A', seriesIndex: 2 },
      { title: 'A2', series: 'A', seriesIndex: 2 },
      { title: 'B2', series: 'B', seriesIndex: 2 }
    ];

    expect(laterInSeries(books, 'A1', ['A2']).map((b) => b.title)).toEqual([
      'A2',
      'A2 (other edition)',
      'A3'
    ]);
    expect(laterInSeries(books, 'A3', [])).toEqual([]);
    expect(laterInSeries([{ title: 'X' }], 'X', [])).toEqual([]);
  });
});

describe('copyLorebookTo', () => {
  it('adds entries the next book lacks, visible from its start', async () => {
    const { saveLoreEntries } = await import('./lorebook');

    await saveLoreEntries('Vol 1', [aoi, { ...aoi, id: 'b', name: '東京', keys: ['東京'] }]);
    await saveLoreEntries('Vol 2', [{ ...aoi, id: 'own', content: 'Already known.' }]);

    expect(await copyLorebookTo('Vol 1', 'Vol 2')).toBe(1);

    const target = await getLorebook('Vol 2');

    expect(target.entries.map((e) => [e.name, e.content, e.firstSeen, e.fromBook])).toEqual([
      ['葵', 'Already known.', 0, undefined],
      ['東京', 'A student.', 0, 'Vol 1']
    ]);
    expect(target.processedUpTo).toBe(0);
  });
});

describe('toSillyTavern', () => {
  it('exports World Info entries', () => {
    const exported = toSillyTavern({ title: 'Book', entries: [aoi], processedUpTo: 10 });

    expect(exported.entries[0]).toMatchObject({
      uid: 0,
      key: ['葵'],
      comment: '葵 (あおい)',
      content: 'A student.'
    });
  });
});
