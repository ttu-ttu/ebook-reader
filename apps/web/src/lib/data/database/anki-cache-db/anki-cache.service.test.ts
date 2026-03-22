/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createAnkiCacheDb } from './factory';
import { AnkiCacheService } from './anki-cache.service';

async function deleteDb(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe('AnkiCacheService lemmas storage', () => {
  it('stores lemmas and lemmaReadings separately', async () => {
    const dbName = `anki-cache-lemmas-${Date.now()}`;
    await deleteDb(dbName);
    const db = await createAnkiCacheDb(dbName);
    const service = new AnkiCacheService(Promise.resolve(db));

    await service.setLemmas('訊く', {
      lemmas: ['訊く'],
      lemmaReadings: ['きく']
    });

    const stored = await service.getLemmas('訊く');
    expect(stored).toEqual({
      lemmas: ['訊く'],
      lemmaReadings: ['きく']
    });

    db.close();
    await deleteDb(dbName);
  });

  it('stores lemmaReadings in batch writes and returns them in batch reads', async () => {
    const dbName = `anki-cache-lemmas-batch-${Date.now()}`;
    await deleteDb(dbName);
    const db = await createAnkiCacheDb(dbName);
    const service = new AnkiCacheService(Promise.resolve(db));

    await service.setLemmasBatch([
      { token: '訊く', lemmas: ['訊く'], lemmaReadings: ['きく'] },
      { token: '聞く', lemmas: ['聞く'], lemmaReadings: ['きく'] }
    ]);

    const batch = await service.getLemmasBatch(['訊く', '聞く']);
    expect(batch.get('訊く')).toEqual({
      lemmas: ['訊く'],
      lemmaReadings: ['きく']
    });
    expect(batch.get('聞く')).toEqual({
      lemmas: ['聞く'],
      lemmaReadings: ['きく']
    });

    db.close();
    await deleteDb(dbName);
  });
});
