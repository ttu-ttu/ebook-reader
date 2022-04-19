/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { IDBPDatabase } from 'idb';
import { Subject, from } from 'rxjs';
import { map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import type BooksDb from './versions/books-db';
import type { BooksDbBookData, BooksDbBookmarkData } from './versions/books-db';

const LAST_ITEM_KEY = 0;

export class DatabaseService {
  private db$ = from(this.db).pipe(shareReplay({ refCount: true, bufferSize: 1 }));

  isReady$ = this.db$.pipe(map((db) => !!db));

  dataListChanged$ = new Subject<void>();

  dataList$ = this.dataListChanged$.pipe(
    startWith(0),
    switchMap(() => this.db$),
    switchMap((db) => db.getAll('data')),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  dataIds$ = this.dataListChanged$.pipe(
    startWith(0),
    switchMap(() => this.db$),
    switchMap((db) => db.getAllKeys('data')),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  bookmarksChanged$ = new Subject<void>();

  bookmarks$ = this.bookmarksChanged$.pipe(
    startWith(0),
    switchMap(() => this.db$),
    switchMap((db) => db.getAll('bookmark')),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  lastItemChanged$ = new Subject<void>();

  lastItem$ = this.lastItemChanged$.pipe(
    startWith(0),
    switchMap(() => this.db$),
    switchMap((db) => db.get('lastItem', LAST_ITEM_KEY)),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  constructor(public db: Promise<IDBPDatabase<BooksDb>>) {}

  async getData(dataId: number) {
    if (!Number.isNaN(dataId)) {
      const db = await this.db;
      return db.get('data', dataId);
    }
    return undefined;
  }

  async getDataListByQuery(query: number | IDBKeyRange | null | undefined) {
    const db = await this.db;
    return db.getAll('data', query);
  }

  async upsertData(data: Omit<BooksDbBookData, 'id'>) {
    const db = await this.db;

    let dataId: number;

    const tx = db.transaction('data', 'readwrite');
    const { store } = tx;
    const oldId = await store.index('title').getKey(data.title);

    if (oldId) {
      dataId = await store.put({
        ...data,
        id: oldId
      });
    } else {
      // Until https://github.com/jakearchibald/idb/issues/150 resolves
      const bookDataWithoutKey: Omit<BooksDbBookData, 'id'> = data;
      dataId = await store.add(bookDataWithoutKey as BooksDbBookData);
    }
    await tx.done;
    this.dataListChanged$.next();
    return dataId;
  }

  async deleteData(dataIds: number[]) {
    const db = await this.db;

    const lastItemObj = await db.get('lastItem', LAST_ITEM_KEY);
    const bookmarkIds = await db.getAllKeys('bookmark');

    const deleteBookPromises = dataIds.map((id) =>
      this.deleteSingleData(id, {
        lastItem: lastItemObj?.dataId,
        bookmarkIds: new Set(bookmarkIds)
      })
    );
    await Promise.all(deleteBookPromises);
  }

  async getBookmark(dataId: number) {
    const db = await this.db;
    return db.get('bookmark', dataId);
  }

  async putBookmark(bookmarkData: BooksDbBookmarkData) {
    const db = await this.db;
    const result = await db.put('bookmark', bookmarkData);
    this.bookmarksChanged$.next();
    return result;
  }

  async putLastItem(dataId: number) {
    const db = await this.db;
    const result = await db.put('lastItem', { dataId }, LAST_ITEM_KEY);
    this.lastItemChanged$.next();
    return result;
  }

  async deleteLastItem() {
    const db = await this.db;
    await db.delete('lastItem', LAST_ITEM_KEY);
    this.lastItemChanged$.next();
  }

  private async deleteSingleData(
    dataId: number,
    cachedData: {
      bookmarkIds: Set<number>;
      lastItem: number | undefined;
    }
  ) {
    const db = await this.db;

    const storeNames: ('data' | 'bookmark' | 'lastItem')[] = ['data'];

    const shouldDeleteLastItem = cachedData.lastItem === dataId;
    const shouldDeleteBookmark = cachedData.bookmarkIds.has(dataId);

    if (shouldDeleteLastItem) {
      storeNames.push('lastItem');
    }
    if (shouldDeleteBookmark) {
      storeNames.push('bookmark');
    }

    const tx = db.transaction(storeNames, 'readwrite');

    if (shouldDeleteLastItem) {
      await tx.objectStore('lastItem').delete(LAST_ITEM_KEY);
    }
    if (shouldDeleteBookmark) {
      await tx.objectStore('bookmark').delete(dataId);
    }
    await tx.objectStore('data').delete(dataId);
    await tx.done;

    if (shouldDeleteLastItem) {
      this.lastItemChanged$.next();
    }
    this.dataListChanged$.next();
  }
}
