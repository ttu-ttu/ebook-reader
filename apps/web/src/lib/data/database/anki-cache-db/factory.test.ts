/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { createAnkiCacheDb } from './factory';

async function deleteDb(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe('Anki cache DB schema', () => {
  it('does not create legacy stores for fresh databases', async () => {
    const dbName = `anki-cache-fresh-${Date.now()}`;
    await deleteDb(dbName);

    const db = await createAnkiCacheDb(dbName);

    expect(db.objectStoreNames.contains('wordData')).toBe(true);
    expect(db.objectStoreNames.contains('tokenize')).toBe(true);
    expect(db.objectStoreNames.contains('lemmatize')).toBe(true);
    expect(db.objectStoreNames.contains('termEntries')).toBe(true);
    expect(db.objectStoreNames.contains('documentTokenCounts')).toBe(true);

    expect(db.objectStoreNames.contains('tokenColor')).toBe(false);
    expect(db.objectStoreNames.contains('tokenCardIds')).toBe(false);

    db.close();
    await deleteDb(dbName);
  });

  it('removes legacy stores when upgrading from v5', async () => {
    const dbName = `anki-cache-upgrade-${Date.now()}`;
    await deleteDb(dbName);

    const legacyDb = await openDB(dbName, 5, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('tokenColor', { keyPath: 'token' });
          db.createObjectStore('tokenize', { keyPath: 'text' });
          db.createObjectStore('lemmatize', { keyPath: 'token' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('tokenCardIds', { keyPath: 'token' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('termEntries', { keyPath: 'token' });
        }
        if (oldVersion < 4) {
          db.createObjectStore('wordData', { keyPath: 'word' });
        }
        if (oldVersion < 5) {
          db.createObjectStore('documentTokenCounts', { keyPath: 'key' });
        }
      }
    });
    legacyDb.close();

    const upgradedDb = await createAnkiCacheDb(dbName);

    expect(upgradedDb.objectStoreNames.contains('tokenColor')).toBe(false);
    expect(upgradedDb.objectStoreNames.contains('tokenCardIds')).toBe(false);
    expect(upgradedDb.objectStoreNames.contains('wordData')).toBe(true);
    expect(upgradedDb.objectStoreNames.contains('tokenize')).toBe(true);
    expect(upgradedDb.objectStoreNames.contains('lemmatize')).toBe(true);
    expect(upgradedDb.objectStoreNames.contains('termEntries')).toBe(true);
    expect(upgradedDb.objectStoreNames.contains('documentTokenCounts')).toBe(true);

    upgradedDb.close();
    await deleteDb(dbName);
  });
});
