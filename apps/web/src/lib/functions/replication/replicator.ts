/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { BackupStorageHandler } from '$lib/data/storage/handler/backup-handler';
import { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
import { storage } from '$lib/data/window/navigator/storage';
import { StorageDataType, StorageKey } from '$lib/data/storage/storage-types';
import { database, requestPersistentStorage$ } from '$lib/data/store';
import loadEpub from '$lib/functions/file-loaders/epub/load-epub';
import loadHtmlz from '$lib/functions/file-loaders/htmlz/load-htmlz';
import loadTxt from '$lib/functions/file-loaders/txt/load-txt';
import type { LoadData } from '$lib/functions/file-loaders/types';
import { handleErrorDuringReplication } from '$lib/functions/replication/error-handler';
import { throwIfAborted } from '$lib/functions/replication/replication-error';
import {
  replicationProgress$,
  type ReplicationContext
} from '$lib/functions/replication/replication-progress';
import pLimit from 'p-limit';

export const exporterVersion = 1;

export async function importData(
  document: Document,
  targetHandler: BaseStorageHandler,
  files: File[],
  cancelSignal: AbortSignal
) {
  const dataIds: number[] = [];
  const tasks: Promise<void>[] = [];
  const lastBookModified = new Date().getTime();
  const progressBase = 3; // load -> save -> cover;
  const maxProgress = progressBase * files.length;
  const limiter = pLimit(1);

  let errorMessage = '';

  replicationProgress$.next({ progressBase, maxProgress });

  await persistStorage(targetHandler.storageType);

  if (targetHandler.isCacheDisabled()) {
    targetHandler.clearData(false);
  }

  files.forEach((file) =>
    tasks.push(
      limiter(async () => {
        let currentTitle = file.name;

        try {
          throwIfAborted(cancelSignal);

          let bookContent: LoadData;

          if (file.name.endsWith('.epub')) {
            bookContent = await loadEpub(file, document, lastBookModified);
          } else if (file.name.endsWith('.txt')) {
            bookContent = await loadTxt(file, lastBookModified);
          } else {
            bookContent = await loadHtmlz(file, document, lastBookModified);
          }

          checkCancelAndProgress(cancelSignal, true, true);

          currentTitle = bookContent.title;

          targetHandler.startContext(
            { title: bookContent.title, imagePath: bookContent.coverImage || '' },
            cancelSignal
          );

          dataIds.push(await targetHandler.saveBook(bookContent, false));

          checkCancelAndProgress(cancelSignal, false);

          if (bookContent.coverImage) {
            await targetHandler.saveCover(bookContent.coverImage);
          }

          database.dataListChanged$.next(targetHandler);

          checkCancelAndProgress(cancelSignal, true, !bookContent.coverImage);
        } catch (error: any) {
          errorMessage = handleErrorDuringReplication(error, `Error importing ${currentTitle}: `, [
            limiter
          ]);
        }
      })
    )
  );

  await Promise.all(tasks).catch(() => {});

  return errorMessage;
}

export async function importBackup(
  sourceHandler: BackupStorageHandler,
  targetHandler: BaseStorageHandler,
  file: File,
  cancelSignal: AbortSignal
) {
  return replicateData(
    sourceHandler,
    targetHandler,
    true,
    await sourceHandler.setBackupZip(file),
    [
      StorageDataType.DATA,
      StorageDataType.PROGRESS,
      StorageDataType.STATISTICS,
      StorageDataType.READING_GOALS
    ],
    cancelSignal
  );
}

export async function replicateData(
  sourceHandler: BaseStorageHandler,
  targetHandler: BaseStorageHandler,
  refreshDataList: boolean,
  contexts: ReplicationContext[],
  dataToReplicate: StorageDataType[],
  cancelSignal?: AbortSignal
) {
  const bookOperationsLength = dataToReplicate.filter(
    (entry) => entry !== StorageDataType.READING_GOALS
  ).length;
  const otherOperationsLength = dataToReplicate.length - bookOperationsLength;
  // recent check -> source retrieval -> target storage per data type + retrieve and store cover
  const progressBaseForBookOperations = bookOperationsLength ? bookOperationsLength * 4 + 2 : 0;
  const progressBaseForOtherOperations = otherOperationsLength * 4;
  const maxProgress =
    progressBaseForBookOperations * contexts.length + progressBaseForOtherOperations;
  const processBookData = dataToReplicate.includes(StorageDataType.DATA);
  const processProgressData = dataToReplicate.includes(StorageDataType.PROGRESS);
  const processStatistics = dataToReplicate.includes(StorageDataType.STATISTICS);
  const processReadingGoals = dataToReplicate.includes(StorageDataType.READING_GOALS);
  const replicationLimiter = pLimit(1);
  const replicationTasks: Promise<void>[] = [];

  let errorMessage = '';
  let processed = 0;

  replicationProgress$.next({ maxProgress });

  await persistStorage(targetHandler.storageType).catch(() => {});

  [sourceHandler, targetHandler].forEach((handler) => {
    if (handler.isCacheDisabled()) {
      handler.clearData(false);
    }
  });

  contexts.forEach((context) =>
    replicationTasks.push(
      replicationLimiter(async () => {
        try {
          throwIfAborted(cancelSignal);

          let dataProcessed = false;

          sourceHandler.startContext(context, cancelSignal);
          targetHandler.startContext(context, cancelSignal);

          if (processBookData) {
            if (
              await targetHandler.isBookPresentAndUpToDate(
                await sourceHandler.getFilenameForRecentCheck('bookdata_')
              )
            ) {
              checkCancelAndProgress(cancelSignal, true, true);
              checkCancelAndProgress(cancelSignal, true, true);
            } else {
              const bookData = await sourceHandler.getBook();

              checkCancelAndProgress(cancelSignal);

              if (bookData) {
                await targetHandler.saveBook(bookData);
                dataProcessed = true;
              }

              checkCancelAndProgress(cancelSignal, bookOperationsLength === 1, !bookData);
            }
          }

          if (processProgressData) {
            if (
              await targetHandler.isProgressPresentAndUpToDate(
                await sourceHandler.getFilenameForRecentCheck('progress_')
              )
            ) {
              checkCancelAndProgress(cancelSignal, !dataProcessed, true);
              checkCancelAndProgress(cancelSignal, !dataProcessed, true);
            } else {
              const progressData = await sourceHandler.getProgress();

              checkCancelAndProgress(cancelSignal, !dataProcessed);

              if (progressData) {
                await targetHandler.saveProgress(progressData);

                dataProcessed = true;
              }

              checkCancelAndProgress(cancelSignal, !dataProcessed, !progressData);
            }
          }

          if (processStatistics) {
            if (
              await targetHandler.areStatisticsPresentAndUpToDate(
                await sourceHandler.getFilenameForRecentCheck('statistics_')
              )
            ) {
              checkCancelAndProgress(cancelSignal, !dataProcessed, true);
              checkCancelAndProgress(cancelSignal, !dataProcessed, true);
            } else {
              const { statistics, lastStatisticModified } = await sourceHandler.getStatistics();

              checkCancelAndProgress(cancelSignal, !dataProcessed);

              if (statistics) {
                await targetHandler.saveStatistics(statistics, lastStatisticModified);

                dataProcessed = true;
              }

              checkCancelAndProgress(cancelSignal, !dataProcessed, !statistics);
            }
          }

          if (dataProcessed) {
            const coverData = await sourceHandler.getCover();

            checkCancelAndProgress(cancelSignal, !coverData);

            await targetHandler.saveCover(coverData);

            checkCancelAndProgress(cancelSignal);

            if (refreshDataList) {
              database.dataListChanged$.next(targetHandler);
            }

            if (targetHandler.storageType === StorageKey.BROWSER && processProgressData) {
              database.bookmarksChanged$.next();
            }
          } else {
            checkCancelAndProgress(cancelSignal, true, true);
            checkCancelAndProgress(cancelSignal, true, true);
          }

          processed += 1;
        } catch (error: any) {
          errorMessage = handleErrorDuringReplication(
            error,
            `Error Processing ${context.title}: `,
            [replicationLimiter],
            progressBaseForBookOperations
          );
        }
      })
    )
  );

  if (processReadingGoals) {
    replicationTasks.push(
      replicationLimiter(async () => {
        try {
          if (
            await targetHandler.areReadingGoalsPresentAndUpToDate(
              await sourceHandler.getFilenameForRecentCheck(
                BaseStorageHandler.readingGoalsFilePrefix
              )
            )
          ) {
            checkCancelAndProgress(cancelSignal, true, true);
            checkCancelAndProgress(cancelSignal, true, true);
          } else {
            const { readingGoals, lastGoalModified } = await sourceHandler.getReadingGoals();

            checkCancelAndProgress(cancelSignal);

            if (readingGoals) {
              await targetHandler.saveReadingGoals(readingGoals, lastGoalModified);
            }

            checkCancelAndProgress(cancelSignal, false, !readingGoals);
          }

          processed += 1;
        } catch (error) {
          errorMessage = handleErrorDuringReplication(
            error,
            `Error Processing Reading Goals: `,
            [replicationLimiter],
            progressBaseForOtherOperations
          );
        }
      })
    );
  }

  await Promise.all(replicationTasks).catch(() => {});

  if (targetHandler instanceof BackupStorageHandler) {
    await targetHandler
      .createExportZip(document, cancelSignal?.aborted || !processed)
      .catch((error) => {
        errorMessage = error.message;
      });
  }

  return errorMessage;
}

async function persistStorage(target: StorageKey) {
  if (target === StorageKey.BROWSER && requestPersistentStorage$.getValue()) {
    try {
      await storage.persist();
    } catch (_) {
      // no-op
    }
  }
}

function checkCancelAndProgress(
  cancelSignal: AbortSignal | undefined,
  allowCancel = true,
  addDefaultProgress = false
) {
  if (allowCancel) {
    throwIfAborted(cancelSignal);
  }

  if (addDefaultProgress) {
    BaseStorageHandler.reportProgress();
  }

  BaseStorageHandler.completeStep();
}
