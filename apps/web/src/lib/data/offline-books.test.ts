/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';

vi.mock('$lib/data/account', () => ({
  accountReady: async () => null,
  accountSyncUrl: '/account/sync/',
  currentAccount: () => null
}));

// Same order as the app: the factory first, because the handlers import each other.
await import('$lib/data/storage/storage-handler-factory');
const { homeOfflineTitles, keepBooksOffline } = await import('./offline-books');
const { database } = await import('$lib/data/store');

const card = (title: string, extra: Partial<BookCardProps> = {}): BookCardProps => ({
  id: 1,
  title,
  imagePath: '',
  characters: 0,
  lastBookModified: 0,
  lastBookOpen: 0,
  progress: 0,
  lastBookmarkModified: 0,
  isPlaceholder: false,
  ...extra
});

describe('homeOfflineTitles', () => {
  it('takes My books and Continue reading, not visual novels or removed books', () => {
    const cards = [
      card('棚'),
      card('読書中', { progress: 0.3, lastBookOpen: 5 }),
      card('外した', { progress: 0.3, lastBookOpen: 5 }),
      card('ゲーム', { vn: true }),
      card('ストア')
    ];

    expect(homeOfflineTitles(cards, ['棚', 'ゲーム'], { 外した: 10 })).toEqual(['棚', '読書中']);
  });
});

describe('keepBooksOffline', () => {
  it('leaves books already in the browser alone', async () => {
    const db = await database.db;
    const fetch = vi.fn(async () => new Response('[]'));

    await db.add('data', {
      title: '手元',
      styleSheet: '',
      elementHtml: '<p>本</p>',
      blobs: {},
      coverImage: '',
      hasThumb: false,
      characters: 1,
      sections: []
    } as any);
    vi.stubGlobal('fetch', fetch);

    await keepBooksOffline(window, ['手元']);

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
