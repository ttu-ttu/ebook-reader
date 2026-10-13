/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The real handler pulls in every storage source (and their circular imports).
vi.mock('$lib/data/storage/handler/calibre-handler', () => ({
  CalibreStorageHandler: { syncFileUrl: (title: string, name: string) => `/sync/${title}/${name}` }
}));

const account = vi.hoisted(() => ({ user: null as { id: string; username: string } | null }));

vi.mock('$lib/data/account', () => ({
  accountReady: async () => account.user,
  currentAccount: () => account.user
}));

import { readerDb } from '$lib/data/reader-db';
import { getLorebook, saveLoreEntries, type LoreEntry } from '$lib/data/lorebook';
import { deleteSavedRecap, getSavedRecaps } from '$lib/data/recap';
import { enableExtrasSync, syncExtras } from './extras-sync';

const entry = (name: string): LoreEntry => ({
  id: name,
  name,
  reading: '',
  category: 'character',
  keys: [name],
  content: `${name}.`,
  firstSeen: 0,
  updated: 0
});

/** A WebDAV folder in memory; returns the files and the fetch calls. */
function server(files: Record<string, unknown> = {}) {
  const calls: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);

      if (init?.method === 'PUT') {
        files[url] = JSON.parse(init.body as string);
        return new Response('', { status: 201 });
      }

      return url in files
        ? new Response(JSON.stringify(files[url]))
        : new Response('', { status: 404 });
    })
  );

  return { files, calls };
}

describe('extras sync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    account.user = null;
  });

  it('only syncs books it was turned on for', async () => {
    const { calls } = server();

    await syncExtras('lorebook', 'Not synced');

    expect(calls).toEqual([]);
  });

  it('uploads a newer local lorebook and adopts a newer remote one', async () => {
    const { files } = server();

    enableExtrasSync('Lore');
    await saveLoreEntries('Lore', [entry('葵')]);
    await syncExtras('lorebook', 'Lore');

    expect((files['/sync/Lore/lorebook.json'] as { entries: LoreEntry[] }).entries).toHaveLength(1);
    expect(files['/sync/Lore/lorebook.json']).not.toHaveProperty('account');

    files['/sync/Lore/lorebook.json'] = {
      title: 'Lore',
      entries: [entry('葵'), entry('東京')],
      processedUpTo: 900,
      modified: Date.now() + 60_000
    };
    await syncExtras('lorebook', 'Lore');

    const lorebook = await getLorebook('Lore');

    expect(lorebook.entries.map((e) => e.name)).toEqual(['葵', '東京']);
    expect(lorebook.processedUpTo).toBe(900);
  });

  it('keeps a local save made while the remote copy was being fetched', async () => {
    const { files } = server();

    enableExtrasSync('Race');
    await saveLoreEntries('Race', [entry('葵')]);
    await syncExtras('lorebook', 'Race');

    const fetchMock = vi.mocked(fetch);
    const respond = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(async (url, init) => {
      await saveLoreEntries('Race', [entry('葵'), entry('東京')]);
      return respond(url, init);
    });
    await syncExtras('lorebook', 'Race');

    expect((await getLorebook('Race')).entries.map((e) => e.name)).toEqual(['葵', '東京']);
    expect((files['/sync/Race/lorebook.json'] as { entries: LoreEntry[] }).entries).toHaveLength(2);
  });

  it('combines saved recaps from both sides and keeps deletions', async () => {
    const recap = (created: number) => ({
      position: created,
      text: `r${created}`,
      created,
      model: 'm'
    });
    const { files } = server({
      '/sync/Recaps/recaps.json': {
        title: 'Recaps',
        chapters: { c2: { summary: 'two', characters: 1, model: 'm' } },
        saved: [recap(2), recap(3)]
      }
    });

    enableExtrasSync('Recaps');
    await (
      await readerDb()
    ).put('recaps', {
      title: 'Recaps',
      chapters: { c1: { summary: 'one', characters: 1, model: 'm' } },
      saved: [recap(1)]
    });
    await syncExtras('recaps', 'Recaps');

    expect((await getSavedRecaps('Recaps')).map((r) => r.created)).toEqual([1, 2, 3]);

    await deleteSavedRecap('Recaps', 3);
    await syncExtras('recaps', 'Recaps');

    const uploaded = files['/sync/Recaps/recaps.json'] as {
      chapters: object;
      saved: { created: number }[];
      deletedSaved: number[];
    };

    expect(uploaded.saved.map((r) => r.created)).toEqual([1, 2]);
    expect(uploaded.deletedSaved).toEqual([3]);
    expect(Object.keys(uploaded.chapters).sort()).toEqual(['c1', 'c2']);
  });

  it("doesn't upload another account's cached lorebook", async () => {
    const { files } = server();

    enableExtrasSync('Private');
    await (
      await readerDb()
    ).put('lorebooks', {
      title: 'Private',
      entries: [entry('秘密')],
      processedUpTo: 10,
      modified: 1,
      account: 'alice'
    });
    account.user = { id: 'bob', username: 'bob' };
    await syncExtras('lorebook', 'Private');

    expect(JSON.stringify(files)).not.toContain('秘密');
    expect((await getLorebook('Private')).entries).toEqual([]);
  });
});
