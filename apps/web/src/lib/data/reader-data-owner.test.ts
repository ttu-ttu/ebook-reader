/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/data/calibre', () => ({
  loadCalibreCatalog: async () => [{ title: 'Calibre' }]
}));

const { database } = await import('$lib/data/store');
const { releaseReaderData } = await import('$lib/data/reader-data-owner');

async function seed() {
  const db = await database.db;
  for (const [id, title] of [
    [1, 'Calibre'],
    [2, 'Local']
  ] as const) {
    await db.put('data', { id, title } as any);
    await db.put('bookmark', { dataId: id } as any);
    await db.put('statistic', { title, dateKey: '2026-10-12' } as any);
    await db.put('lastModified', { title, dataType: 'statistic', lastModifiedValue: 1 } as any);
  }
  await db.put('readingGoal', { goalStartDate: '2026-10-01', goalEndDate: '' } as any);
}

async function counts() {
  const db = await database.db;
  return Promise.all(
    (['data', 'bookmark', 'statistic', 'lastModified', 'readingGoal'] as const).map((store) =>
      db.count(store)
    )
  );
}

const user = (id: string) => ({ id, username: id });

describe('releaseReaderData', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await seed();
  });

  it('adopts data from before owners were recorded and keeps it for the same reader', async () => {
    await releaseReaderData(user('a'));
    await releaseReaderData(user('a'));
    expect(await counts()).toEqual([2, 2, 2, 2, 1]);
  });

  it("clears Calibre books' progress, statistics and goals for another reader", async () => {
    await releaseReaderData(user('a'));
    await releaseReaderData(user('b'));
    expect(await counts()).toEqual([2, 1, 1, 1, 0]);
    const db = await database.db;
    expect(await db.get('bookmark', 2)).toBeTruthy();
    expect(await db.get('statistic', ['Local', '2026-10-12'])).toBeTruthy();
  });

  it('treats signing out as another reader', async () => {
    await releaseReaderData(user('a'));
    await releaseReaderData(null);
    expect(await counts()).toEqual([2, 1, 1, 1, 0]);
  });
});
