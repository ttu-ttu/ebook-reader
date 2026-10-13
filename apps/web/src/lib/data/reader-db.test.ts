/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { readerDb } from './reader-db';

describe('readerDb', () => {
  it('reports an older tab blocking the upgrade instead of waiting forever, then retries', async () => {
    const oldTab = await openDB('ttu-annotations', 1, {
      upgrade(db) {
        db.createObjectStore('annotations', { keyPath: 'title' });
        db.createObjectStore('recaps', { keyPath: 'title' });
      }
    });

    await oldTab.put('recaps', { title: 'Kept', chapters: {} });
    await expect(readerDb()).rejects.toThrow(/other tabs/);

    oldTab.close();

    const db = await readerDb();

    expect(db.version).toBe(4);
    expect(await db.get('recaps', 'Kept')).toEqual({ title: 'Kept', chapters: {} });
    expect([...db.objectStoreNames]).toContain('lorebooks');
    expect([...db.objectStoreNames]).toContain('vnRead');
    expect([...db.objectStoreNames]).toContain('absSubtitles');
  });
});
