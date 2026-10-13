/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

const account = vi.hoisted(() => ({ user: null as { id: string; username: string } | null }));

vi.mock('$lib/data/account', () => ({
  accountReady: async () => account.user,
  accountSyncUrl: '/account/sync/',
  currentAccount: () => account.user
}));

// Same order as the app: the factory first, because the handlers import each other.
await import('$lib/data/storage/storage-handler-factory');
const { CalibreStorageHandler } = await import('./calibre-handler');

describe('CalibreStorageHandler.syncFileUrl', () => {
  it('uses the shared folder while signed out', () => {
    account.user = null;

    expect(CalibreStorageHandler.syncFileUrl('本 1', 'annotations.json')).toBe(
      '/calibre/sync/ttu-reader-data/%E6%9C%AC%201/annotations.json'
    );
  });

  it("uses the account's folder while signed in", () => {
    account.user = { id: 'a', username: 'a' };

    expect(CalibreStorageHandler.syncFileUrl('本', 'annotations.json')).toBe(
      '/account/sync/ttu-reader-data/%E6%9C%AC/annotations.json'
    );
  });

  it('sanitizes titles like the folder names', () => {
    account.user = null;

    expect(CalibreStorageHandler.syncFileUrl('A/B?', 'x.json')).not.toContain('/B');
  });
});

describe('CalibreStorageHandler.getBookList', () => {
  it('skips account files of books no longer in the catalog or the shared folder', async () => {
    account.user = { id: 'a', username: 'a' };

    const json = (body: unknown) => new Response(JSON.stringify(body));
    const book = { id: 1, title: '本1', authors: '', series: '', seriesIndex: null, added: 0 };

    vi.stubGlobal('fetch', async (url: string) => {
      if (url === '/calibre/catalog.json') return json({ books: [{ ...book, cover: '' }] });
      if (url === '/calibre/difficulty.json') return json({ books: {} });
      if (url === '/calibre/sync/ttu-reader-data/') return json([]);
      if (url === '/account/sync/ttu-reader-data/') {
        return json([
          { name: '本1', type: 'directory' },
          { name: '古い', type: 'directory' }
        ]);
      }
      if (url.startsWith('/account/sync/ttu-reader-data/')) {
        return json([{ name: 'progress_1_6_100_0.5.json', type: 'file' }]);
      }
      return new Response('', { status: 404 });
    });

    const cards = await new CalibreStorageHandler(window).getBookList();

    expect(cards.map((card) => [card.title, card.progress])).toEqual([['本1', 0.5]]);
    vi.unstubAllGlobals();
  });
});

describe('CalibreStorageHandler.listAccountTitles', () => {
  it("lists the account's book folders, none while signed out", async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url === '/account/sync/ttu-reader-data/'
        ? new Response(
            JSON.stringify([
              { name: '本1', type: 'directory' },
              { name: 'reading-goals_1_6_0.json', type: 'file' }
            ])
          )
        : new Response('[]')
    );

    account.user = { id: 'a', username: 'a' };
    expect(await new CalibreStorageHandler(window).listAccountTitles()).toEqual(['本1']);

    account.user = null;
    expect(await new CalibreStorageHandler(window).listAccountTitles()).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe('CalibreStorageHandler sync errors', () => {
  const unauthorized = async () => new Response('', { status: 401 });

  it('asks a signed-out reader to sign in rather than saying the sign-in expired', async () => {
    account.user = null;
    vi.stubGlobal('fetch', unauthorized);

    await expect(
      new CalibreStorageHandler(window)['davRequest']('/calibre/sync/x', { method: 'MKCOL' })
    ).rejects.toThrow('needs an account');
    vi.unstubAllGlobals();
  });

  it('says the sign-in expired while signed in', async () => {
    account.user = { id: 'a', username: 'a' };
    vi.stubGlobal('fetch', unauthorized);

    await expect(
      new CalibreStorageHandler(window)['davRequest']('/account/sync/x', { method: 'MKCOL' })
    ).rejects.toThrow('has expired');
    vi.unstubAllGlobals();
  });

  it('lists an empty library, not a failure, while signed out where reads need an account', async () => {
    vi.stubGlobal('fetch', unauthorized);

    account.user = null;
    expect(await new CalibreStorageHandler(window).getBookList()).toEqual([]);

    account.user = { id: 'a', username: 'a' };
    await expect(new CalibreStorageHandler(window).getBookList()).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
