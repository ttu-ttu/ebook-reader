/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookData,
  BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';
import { Subject, from } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';

import type BooksDb from '$lib/data/database/books-db/versions/books-db';
import type { IDBPDatabase } from 'idb';
import LogReportDialog from '$lib/components/log-report-dialog.svelte';
import MessageDialog from '$lib/components/message-dialog.svelte';
import { StorageKey } from '$lib/data/storage-manager/storage-source';
import { dialogManager } from '$lib/data/dialog-manager';
import { getStorageHandler } from '$lib/data/storage-manager/storage-manager-factory';
import { handleErrorDuringReplication } from '$lib/functions/replication/error-handler';
import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
import { logger } from '$lib/data/logger';
import pLimit from 'p-limit';
import { replicationProgress$ } from '$lib/functions/replication/replication-progress';
import { throwIfAborted } from '$lib/functions/replication/replication-error';

const LAST_ITEM_KEY = 0;

export class DatabaseService {
  private db$ = from(this.db).pipe(shareReplay({ refCount: true, bufferSize: 1 }));

  isReady$ = this.db$.pipe(map((db) => !!db));

  listLoading$ = new Subject<boolean>();

  dataListChanged$ = new Subject<void>();

  dataList$ = iffBrowser(() =>
    this.dataListChanged$.pipe(
      startWith(true),
      tap((withLoadingSpinner) => {
        if (withLoadingSpinner) {
          this.listLoading$.next(true);
        }
      }),
      switchMap(() =>
        from(
          getStorageHandler(StorageKey.BROWSER, window).then((handler) => handler.getDataList())
        ).pipe(
          catchError((error: unknown) => {
            if (error instanceof Error) {
              const showReport = logger.history.length > 1;

              dialogManager.dialogs$.next([
                {
                  component: showReport ? LogReportDialog : MessageDialog,
                  props: {
                    title: 'Failure',
                    message: showReport ? 'Error(s) occurred' : `An Error occured: ${error.message}`
                  }
                }
              ]);
            }

            return [[]];
          })
        )
      ),
      tap(() => this.listLoading$.next(false)),
      shareReplay({ refCount: true, bufferSize: 1 })
    )
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

  async getDataByTitle(title: string) {
    if (title) {
      const db = await this.db;
      return db.getFromIndex('data', 'title', title);
    }
    return undefined;
  }

  async upsertData(data: Omit<BooksDbBookData, 'id'>) {
    const db = await this.db;

    let dataId: number;
    let bookData: BooksDbBookData;

    const tx = db.transaction('data', 'readwrite');
    const { store } = tx;
    const oldData = await store.index('title').get(data.title);

    if (oldData) {
      bookData = {
        ...data,
        id: oldData.id,
        lastBookModified: data.lastBookModified || oldData.lastBookModified,
        lastBookOpen: data.lastBookOpen || oldData.lastBookOpen
      };
      dataId = await store.put(bookData);
    } else {
      // Until https://github.com/jakearchibald/idb/issues/150 resolves
      const bookDataWithoutKey: Omit<BooksDbBookData, 'id'> = data;
      dataId = await store.add(bookDataWithoutKey as BooksDbBookData);
      bookData = { ...data, id: dataId };
    }
    await tx.done;

    return dataId;
  }

  async deleteData(dataIds: number[], cancelSignal: AbortSignal) {
    const db = await this.db;
    const lastItemObj = await db.get('lastItem', LAST_ITEM_KEY);
    const bookmarkIdData = await db.getAllKeys('bookmark');
    const lastItem = lastItemObj?.dataId;
    const bookmarkIds = new Set(bookmarkIdData);
    const deleted: number[] = [];
    const limiter = pLimit(1);
    const tasks: Promise<void>[] = [];

    let errorMessage = '';

    replicationProgress$.next({
      progressToAdd: 0,
      baseProgress: 100,
      maxProgress: 100 * dataIds.length
    });

    dataIds.forEach((id) =>
      tasks.push(
        limiter(async () => {
          try {
            throwIfAborted(cancelSignal);

            deleted.push(await this.deleteSingleData(db, id, { lastItem, bookmarkIds }));
          } catch (error) {
            errorMessage = handleErrorDuringReplication(
              error,
              `Error deleting Book with id ${id}: `,
              [limiter]
            );
          }
        })
      )
    );

    await Promise.all(tasks).catch(() => {});

    return { error: errorMessage, deleted };
  }

  async getBookmark(dataId: number) {
    const db = await this.db;
    return db.get('bookmark', dataId);
  }

  async putBookmark(bookmarkData: BooksDbBookmarkData) {
    const db = await this.db;
    const result = await db.put('bookmark', bookmarkData);
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
    db: IDBPDatabase<BooksDb>,
    dataId: number,
    cachedData: { bookmarkIds: Set<number>; lastItem: number | undefined }
  ) {
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

    try {
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
    } catch (error: any) {
      try {
        tx.abort();
        await tx.done;
      } catch (_) {
        // no-op
      }

      throw error;
    }

    replicationProgress$.next({ progressToAdd: 100 });

    return dataId;
  }
}
