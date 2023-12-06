/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookData,
  BooksDbBookmarkData,
  BooksDbReadingGoal,
  BooksDbStatistic,
  BooksDbStorageSource
} from '$lib/data/database/books-db/versions/books-db';
import { Observable, Subject, from } from 'rxjs';
import { StorageDataType, StorageKey } from '$lib/data/storage/storage-types';
import { catchError, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import {
  getCurrentReadingGoal,
  mergeReadingGoals,
  readingGoalSortFunction
} from '$lib/data/reading-goal';
import { getDateKey, mergeStatistics, updateStatisticToStore } from '$lib/functions/statistic-util';
import { lastReadingGoalsModified$, readingGoal$, syncTarget$ } from '$lib/data/store';

import type { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
import type BooksDb from '$lib/data/database/books-db/versions/books-db';
import type { IDBPDatabase } from 'idb';
import LogReportDialog from '$lib/components/log-report-dialog.svelte';
import { MergeMode } from '$lib/data/merge-mode';
import MessageDialog from '$lib/components/message-dialog.svelte';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import { dialogManager } from '$lib/data/dialog-manager';
import { getDefaultStatistic } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
import { handleErrorDuringReplication } from '$lib/functions/replication/error-handler';
import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
import { logger } from '$lib/data/logger';
import pLimit from 'p-limit';
import { replicationProgress$ } from '$lib/functions/replication/replication-progress';
import { setStorageSourceDefault } from '$lib/data/storage/storage-source-manager';
import { storageSource$ } from '$lib/data/storage/storage-view';
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

  async getLastModifiedForType(title: string, dataType: string) {
    const db = await this.db;
    const result = await db.get('lastModified', [title, dataType]);

    return result?.lastModifiedValue || 0;
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

  async setFirstBookRead(
    bookTitle: string,
    startDaysHoursForTracker: number,
    existingStatistic?: BooksDbStatistic
  ) {
    const db = await this.db;

    let firstStatistic = existingStatistic;

    if (!firstStatistic) {
      firstStatistic = await db.get('statistic', IDBKeyRange.bound([bookTitle], [bookTitle, []]));
    }

    if (firstStatistic) {
      return [firstStatistic.dateKey, false];
    }

    const dateKey = getDateKey(startDaysHoursForTracker);
    const tx = db.transaction(['statistic', 'lastModified'], 'readwrite');

    try {
      const statisticsStore = tx.objectStore('statistic');
      const lastModifiedStore = tx.objectStore('lastModified');
      const newStatistic = getDefaultStatistic(bookTitle, dateKey);

      await statisticsStore.put(newStatistic);
      await lastModifiedStore.put({
        title: bookTitle,
        dataType: StorageDataType.STATISTICS,
        lastModifiedValue: newStatistic.lastStatisticModified
      });

      await tx.done;
    } catch (error: any) {
      try {
        tx.abort();
        await tx.done;
      } catch (_) {
        // no-op
      }

      throw error;
    }

    return [dateKey, true];
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

  async deleteData(
    dataIds: number[],
    idsToTitles: Map<number, string>,
    cancelSignal: AbortSignal,
    keepLocalStatistics: boolean
  ) {
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

            deleted.push(
              await this.deleteSingleData(
                db,
                id,
                idsToTitles.get(id),
                { lastItem, bookmarkIds },
                !keepLocalStatistics
              )
            );
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

    return db.put('bookmark', bookmarkData);
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
    title: string | undefined,
    cachedData: { bookmarkIds: Set<number>; lastItem: number | undefined },
    shouldDeleteStatistics: boolean
  ) {
    const storeNames: ('data' | 'bookmark' | 'statistic' | 'lastItem' | 'lastModified')[] = [
      'data'
    ];
    const shouldDeleteLastItem = cachedData.lastItem === dataId;
    const shouldDeleteBookmark = cachedData.bookmarkIds.has(dataId);

    if (shouldDeleteLastItem) {
      storeNames.push('lastItem');
    }

    if (shouldDeleteBookmark) {
      storeNames.push('bookmark');
    }

    if (shouldDeleteStatistics) {
      storeNames.push('statistic');
      storeNames.push('lastModified');
    }

    const tx = db.transaction(storeNames, 'readwrite');

    try {
      if (shouldDeleteLastItem) {
        await tx.objectStore('lastItem').delete(LAST_ITEM_KEY);
      }

      if (shouldDeleteBookmark) {
        await tx.objectStore('bookmark').delete(dataId);
      }

      if (shouldDeleteStatistics) {
        let bookTitle = title;

        if (!bookTitle) {
          bookTitle = (await tx.objectStore('data').get(dataId))?.title;
        }

        if (bookTitle) {
          await tx.objectStore('statistic').delete(IDBKeyRange.bound([bookTitle], [bookTitle, []]));
          await tx.objectStore('lastModified').delete([bookTitle, StorageDataType.STATISTICS]);
        }
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

  async getStatisticsForBook(bookTitle: string) {
    const db = await this.db;

    return db.getAll('statistic', IDBKeyRange.bound([bookTitle], [bookTitle, []]));
  }

  async getStatisticForCompletedBook(bookTitle: string) {
    const db = await this.db;

    return db.getFromIndex('statistic', 'completedBook', [1, bookTitle]);
  }

  async getStatisticsForTimeWindow(startDate: string, endDate: string) {
    const db = await this.db;

    return db.getAllFromIndex('statistic', 'dateKey', IDBKeyRange.bound(startDate, endDate));
  }

  async getStatisticsUntilDate(bookTitle: string, maxDate: string) {
    const db = await this.db;

    const results = await db.getAllFromIndex(
      'statistic',
      'dateKey',
      IDBKeyRange.upperBound(maxDate)
    );

    return results.filter((result) => result.title === bookTitle);
  }

  async storeStatistics(
    bookTitle: string,
    statistics: BooksDbStatistic[],
    saveBehavior: ReplicationSaveBehavior,
    statisticsMergeMode: MergeMode,
    currentLastModified = Date.now()
  ) {
    const db = await this.db;

    let statisticsToStore: BooksDbStatistic[] = statistics;
    let newStatisticModified = currentLastModified;

    if (statisticsMergeMode === MergeMode.MERGE) {
      const existingStatistics = await this.getStatisticsForBook(bookTitle);

      statisticsToStore = mergeStatistics(
        statistics,
        existingStatistics,
        saveBehavior === ReplicationSaveBehavior.NewOnly
      );
    }

    ({ newStatisticModified, statisticsToStore } = updateStatisticToStore(
      statisticsToStore,
      newStatisticModified
    ));

    const tx = db.transaction(['statistic', 'lastModified'], 'readwrite');

    try {
      const statisticsStore = tx.objectStore('statistic');
      const lastModifiedStore = tx.objectStore('lastModified');
      const limiter = pLimit(1);
      const tasks: Promise<void>[] = [];

      if (statisticsMergeMode !== MergeMode.LOCAL) {
        tasks.push(
          limiter(async () => {
            try {
              await statisticsStore.delete(IDBKeyRange.bound([bookTitle], [bookTitle, []]));
            } catch (error: any) {
              limiter.clearQueue();

              throw error;
            }
          })
        );
      }

      statisticsToStore.forEach((statistic) =>
        tasks.push(
          limiter(async () => {
            try {
              await statisticsStore.put(statistic);
            } catch (error: any) {
              limiter.clearQueue();

              throw error;
            }
          })
        )
      );

      tasks.push(
        limiter(async () => {
          try {
            await lastModifiedStore.put({
              title: bookTitle,
              dataType: StorageDataType.STATISTICS,
              lastModifiedValue: newStatisticModified
            });
          } catch (error: any) {
            limiter.clearQueue();

            throw error;
          }
        })
      );

      await Promise.all(tasks);
      await tx.done;
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

  async clearZombieStatistics() {
    try {
      const db = await this.db;
      const books = await db.getAll('data');
      const titles = new Set(books.map((book) => book.title));
      const statistics = await db.getAll('statistic');
      const lastModifiedForStatistics = await db.getAll('lastModified');
      const statisticsToDelete: BooksDbStatistic[] = [];
      const lastModifiedItemsToDelete = new Set<string>();

      for (let index = 0, { length } = statistics; index < length; index += 1) {
        const entry = statistics[index];

        if (!titles.has(entry.title)) {
          statisticsToDelete.push(entry);
        }
      }

      for (let index = 0, { length } = lastModifiedForStatistics; index < length; index += 1) {
        const entry = lastModifiedForStatistics[index];

        if (!titles.has(entry.title)) {
          lastModifiedItemsToDelete.add(entry.title);
        }
      }

      await this.deleteStatistics(statisticsToDelete, [...lastModifiedItemsToDelete]);
    } catch (error: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Failure',
            message: `Error on Deletion: ${error.message}`
          }
        }
      ]);
    }
  }

  async deleteStatistics(statistics: BooksDbStatistic[], lastModifiedTitlesToDelete: string[]) {
    if (!statistics.length && !lastModifiedTitlesToDelete.length) {
      return;
    }

    const db = await this.db;
    const tx = db.transaction(['statistic', 'lastModified'], 'readwrite');
    const titlesToDelete = new Set<string>();

    try {
      const statisticsStore = tx.objectStore('statistic');
      const lastModifiedStore = tx.objectStore('lastModified');
      const limiter = pLimit(1);
      const tasks: Promise<void>[] = [];

      for (let index = 0, { length } = lastModifiedTitlesToDelete; index < length; index += 1) {
        titlesToDelete.add(lastModifiedTitlesToDelete[index]);
      }

      statistics.forEach((statistic) =>
        tasks.push(
          limiter(async () => {
            try {
              titlesToDelete.add(statistic.title);
              await statisticsStore.delete([statistic.title, statistic.dateKey]);
            } catch (error: any) {
              limiter.clearQueue();

              throw error;
            }
          })
        )
      );

      [...titlesToDelete].forEach((titleToDelete) =>
        tasks.push(
          limiter(async () => {
            try {
              await lastModifiedStore.delete([titleToDelete, StorageDataType.STATISTICS]);
            } catch (error: any) {
              limiter.clearQueue();

              throw error;
            }
          })
        )
      );

      await Promise.all(tasks);
      await tx.done;
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

  async getReadingGoals() {
    const db = await this.db;

    return db.getAll('readingGoal');
  }

  async getOpenReadingGoals() {
    const db = await this.db;

    return db.getAllFromIndex('readingGoal', 'goalEndDate', '');
  }

  async getCurrentClosedReadingGoal(referenceDate: string) {
    const db = await this.db;
    const readingGoals = await db.getAll('readingGoal', IDBKeyRange.upperBound(referenceDate));

    return readingGoals.find((readingGoal) => readingGoal.goalEndDate >= referenceDate);
  }

  async getReadingGoalsForDateWindow(startDate: string, newStartDate = '', endDate = '') {
    const readingGoals = await this.getReadingGoals();

    if (newStartDate) {
      return readingGoals.filter(
        (readingGoal) =>
          !readingGoal.goalEndDate ||
          (startDate >= readingGoal.goalStartDate && startDate <= readingGoal.goalEndDate) ||
          (readingGoal.goalStartDate >= startDate &&
            (!endDate || readingGoal.goalStartDate <= endDate)) ||
          (newStartDate >= readingGoal.goalStartDate && newStartDate <= readingGoal.goalEndDate) ||
          readingGoal.goalStartDate >= newStartDate
      );
    }

    return readingGoals.filter(
      (readingGoal) =>
        !readingGoal.goalEndDate ||
        (startDate >= readingGoal.goalStartDate && startDate <= readingGoal.goalEndDate) ||
        (readingGoal.goalStartDate >= startDate &&
          (!endDate || readingGoal.goalStartDate <= endDate))
    );
  }

  async updateReadingGoals(
    readingGoalsToDelete: string[],
    readingGoalsToInsert: BooksDbReadingGoal[]
  ) {
    if (!readingGoalsToDelete.length && !readingGoalsToInsert.length) {
      return;
    }

    const db = await this.db;
    const tx = db.transaction(['readingGoal'], 'readwrite');

    try {
      const store = tx.objectStore('readingGoal');
      const limiter = pLimit(1);
      const tasks: Promise<void>[] = [];

      readingGoalsToDelete.forEach((readingGoal) =>
        tasks.push(
          limiter(async () => {
            try {
              await store.delete(readingGoal);
            } catch (error: any) {
              limiter.clearQueue();

              throw error;
            }
          })
        )
      );

      readingGoalsToInsert.forEach((readingGoal) =>
        tasks.push(
          limiter(async () => {
            try {
              await store.put(readingGoal);
            } catch (error: any) {
              limiter.clearQueue();

              throw error;
            }
          })
        )
      );

      await Promise.all(tasks);
      await tx.done;

      lastReadingGoalsModified$.next(Date.now());
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

  async storeReadingGoals(
    readingGoals: BooksDbReadingGoal[],
    saveBehavior: ReplicationSaveBehavior,
    readingGoalsMergeMode: MergeMode,
    lastGoalModified: number
  ) {
    const db = await this.db;

    let readingGoalsToStore: BooksDbReadingGoal[] = readingGoals;
    let newReadingGoalModified = lastGoalModified;

    if (readingGoalsMergeMode === MergeMode.MERGE) {
      const existingReadingGoals = await this.getReadingGoals();

      ({ readingGoalsToStore, newReadingGoalModified } = mergeReadingGoals(
        readingGoals,
        existingReadingGoals,
        saveBehavior === ReplicationSaveBehavior.NewOnly,
        newReadingGoalModified
      ));
    }

    const tx = db.transaction(['readingGoal'], 'readwrite');

    try {
      const readingGoalStore = tx.objectStore('readingGoal');
      const limiter = pLimit(1);
      const tasks: Promise<void>[] = [];

      readingGoalsToStore.sort(readingGoalSortFunction);

      tasks.push(
        limiter(async () => {
          try {
            await readingGoalStore.clear();
          } catch (error: any) {
            limiter.clearQueue();

            throw error;
          }
        })
      );

      readingGoalsToStore.forEach((readingGoal) =>
        tasks.push(
          limiter(async () => {
            try {
              await readingGoalStore.put(readingGoal);
            } catch (error: any) {
              limiter.clearQueue();

              throw error;
            }
          })
        )
      );

      await Promise.all(tasks);
      await tx.done;

      lastReadingGoalsModified$.next(newReadingGoalModified);

      const currentUserGoal = await getCurrentReadingGoal();

      readingGoal$.next(currentUserGoal);
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
}
