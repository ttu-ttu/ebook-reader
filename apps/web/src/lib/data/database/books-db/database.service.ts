/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookData,
  BooksDbBookmarkData,
  BooksDbStorageSource
} from '$lib/data/database/books-db/versions/books-db';
import { Observable, Subject, from } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';

import type { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
import type BooksDb from '$lib/data/database/books-db/versions/books-db';
import type { IDBPDatabase } from 'idb';
import LogReportDialog from '$lib/components/log-report-dialog.svelte';
import MessageDialog from '$lib/components/message-dialog.svelte';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import { StorageKey } from '$lib/data/storage/storage-types';
import { dialogManager } from '$lib/data/dialog-manager';
import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
import { handleErrorDuringReplication } from '$lib/functions/replication/error-handler';
import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
import { logger } from '$lib/data/logger';
import pLimit from 'p-limit';
import { replicationProgress$ } from '$lib/functions/replication/replication-progress';
import { setStorageSourceDefault } from '$lib/data/storage/storage-source-manager';
import { storageSource$ } from '$lib/data/storage/storage-view';
import { syncTarget$ } from '$lib/data/store';
import { throwIfAborted } from '$lib/functions/replication/replication-error';

const LAST_ITEM_KEY = 0;

export class DatabaseService {
  private db$: Observable<Awaited<typeof this.db>>;

  isReady$: Observable<boolean>;

  listLoading$ = new Subject<boolean>();

  dataListChanged$ = new Subject<BaseStorageHandler | undefined>();

  lastHandler: BaseStorageHandler | undefined;

  dataList$ = iffBrowser(() =>
    this.dataListChanged$.pipe(
      startWith(undefined),
      tap((handler) => {
        this.lastHandler = handler;
      }),
      switchMap(() => storageSource$),
      switchMap((storageSource) =>
        from(
          Promise.resolve(this.lastHandler || getStorageHandler(window, storageSource, '')).then(
            (handler) => {
              logger.clearHistory();

              return handler.getBookList();
            }
          )
        ).pipe(
          catchError((error: unknown) => {
            if (error instanceof Error) {
              const showReport = logger.errorCount > 1;

              logger.warn(error.message);

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

            if (storageSource !== StorageKey.BROWSER) {
              this.lastHandler = undefined;
              storageSource$.next(StorageKey.BROWSER);
            }

            return [[]];
          })
        )
      ),
      tap(() => {
        this.lastHandler = undefined;
        this.listLoading$.next(false);
      }),
      shareReplay({ refCount: true, bufferSize: 1 })
    )
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

  storageSourcesChanged$ = new Subject<BooksDbStorageSource[]>();

  constructor(public db: Promise<IDBPDatabase<BooksDb>>) {
    this.db$ = from(db).pipe(shareReplay({ refCount: true, bufferSize: 1 }));
    this.isReady$ = this.db$.pipe(map((x) => !!x));
  }

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

  async upsertData(
    data: Omit<BooksDbBookData, 'id'>,
    saveBehavior: ReplicationSaveBehavior,
    skipTimestampFallback = true,
    removeStorageContext = true
  ) {
    const db = await this.db;

    let dataId: number;
    let bookData: BooksDbBookData;

    const tx = db.transaction('data', 'readwrite');
    const { store } = tx;
    const oldData = await store.index('title').get(data.title);

    if (oldData) {
      if (removeStorageContext) {
        oldData.storageSource = undefined;
      }

      if (
        saveBehavior === ReplicationSaveBehavior.NewOnly &&
        oldData.lastBookModified &&
        data.lastBookModified &&
        oldData.lastBookModified >= data.lastBookModified &&
        (oldData.lastBookOpen || 0) >= (data.lastBookOpen || 0)
      ) {
        bookData = oldData;
        dataId = oldData.id;
      } else {
        bookData = {
          ...data,
          id: oldData.id,
          ...(skipTimestampFallback
            ? { lastBookModified: data.lastBookModified, lastBookOpen: data.lastBookOpen }
            : {
                lastBookModified: data.lastBookModified || oldData.lastBookModified,
                lastBookOpen: data.lastBookOpen || oldData.lastBookOpen
              }),
          ...(removeStorageContext ? { storageSource: undefined } : {})
        };
        dataId = await store.put(bookData);
      }
    } else {
      // Until https://github.com/jakearchibald/idb/issues/150 resolves
      const bookDataWithoutKey: Omit<BooksDbBookData, 'id'> = data;
      dataId = await store.add(bookDataWithoutKey as BooksDbBookData);
      bookData = { ...data, id: dataId };
    }
    await tx.done;

    return bookData;
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

    replicationProgress$.next({ progressBase: 1, maxProgress: dataIds.length });

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

  async putBookmark(bookmarkData: BooksDbBookmarkData, saveBehavior: ReplicationSaveBehavior) {
    const db = await this.db;

    let result: number;

    if (saveBehavior === ReplicationSaveBehavior.Overwrite) {
      result = await db.put('bookmark', bookmarkData);
    } else {
      const existingBookmark = await db.get('bookmark', bookmarkData.dataId);

      if (
        existingBookmark &&
        existingBookmark.lastBookmarkModified &&
        bookmarkData.lastBookmarkModified &&
        (existingBookmark.lastBookmarkModified || 0) >= (bookmarkData.lastBookmarkModified || 0)
      ) {
        result = existingBookmark.dataId;
      } else {
        result = await db.put('bookmark', bookmarkData);
      }
    }

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

    replicationProgress$.next({ progressToAdd: 1 });

    return dataId;
  }

  async getStorageSources() {
    const db = await this.db;

    return db.getAll('storageSource');
  }

  async saveStorageSource(
    storageSource: BooksDbStorageSource,
    oldName: string,
    isSyncTarget: boolean,
    isStorageSourceDefault: boolean
  ) {
    const db = await this.db;
    const tx = db.transaction(['storageSource'], 'readwrite');

    try {
      const store = tx.objectStore('storageSource');

      if (oldName && storageSource.name !== oldName) {
        await store.delete(oldName);
      }

      if (storageSource.name === oldName) {
        await store.put(storageSource);
      } else {
        await store.add(storageSource);
      }

      await tx.done;

      if (isSyncTarget) {
        syncTarget$.next(storageSource.name);
      } else if (oldName) {
        syncTarget$.next('');
      }

      if (isStorageSourceDefault) {
        setStorageSourceDefault(storageSource.name, storageSource.type);
      } else if (oldName) {
        setStorageSourceDefault('', storageSource.type);
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
  }

  async deleteStorageSource(
    toDelete: BooksDbStorageSource,
    wasSyncTarget: boolean,
    wasStorageSourceDefault: boolean
  ) {
    const db = await this.db;

    await db.delete('storageSource', toDelete.name);

    if (wasSyncTarget) {
      syncTarget$.next('');
    }

    if (wasStorageSourceDefault) {
      setStorageSourceDefault('', toDelete.type);
    }
  }
}
