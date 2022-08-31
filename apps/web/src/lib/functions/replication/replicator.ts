/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */
import { StorageDataType, StorageKey } from '$lib/data/storage-manager/storage-source';

import { BackupStorageHandler } from '$lib/data/storage-manager/backup-handler';
import { database, requestPersistentStorage$ } from '$lib/data/store';
import { getStorageHandler } from '$lib/data/storage-manager/storage-manager-factory';
import { storage } from '$lib/data/window/navigator/storage';
import loadEpub from '$lib/functions/file-loaders/epub/load-epub';
import loadHtmlz from '$lib/functions/file-loaders/htmlz/load-htmlz';
import { throwIfAborted } from '$lib/functions/replication/replication-error';
import { handleErrorDuringReplication } from '$lib/functions/replication/error-handler';
import {
  replicationProgress$,
  type ReplicationContext
} from '$lib/functions/replication/replication-progress';
import pLimit from 'p-limit';

export const exporterVersion = 1;

export async function importData(
  window: Window,
  document: Document,
  target: StorageKey,
  files: File[],
  cancelSignal: AbortSignal
) {
  const replicationHandler = await getStorageHandler(target, window);
  const dataIds: number[] = [];
  const tasks: Promise<void>[] = [];
  const lastBookModified = new Date().getTime();
  const baseProgress = 200; // load -> save;
  const maxProgress = baseProgress * files.length;
  const limiter = pLimit(1);

  let errorMessage = '';

  replicationProgress$.next({ baseProgress, maxProgress });

  await persistStorage(target);

  files.forEach((file) =>
    tasks.push(
      limiter(async () => {
        let currentTitle = file.name;

        try {
          throwIfAborted(cancelSignal);

          const bookContent = await (file.name.endsWith('.epub')
            ? loadEpub(file, document, lastBookModified)
            : loadHtmlz(file, document, lastBookModified));

          reportProgressStep(cancelSignal);

          currentTitle = bookContent.title;

          dataIds.push(
            await replicationHandler.saveBook(bookContent, bookContent.title, cancelSignal)
          );

          database.dataListChanged$.next();

          reportProgressStep(cancelSignal);
        } catch (error: any) {
          errorMessage = handleErrorDuringReplication(error, `Error importing ${currentTitle}: `, [
            limiter
          ]);
        }
      })
    )
  );

  await Promise.all(tasks).catch(() => {});

  return { error: errorMessage, dataId: files.length === 1 ? dataIds.at(-1) : undefined };
}

export async function importBackup(
  window: Window,
  target: StorageKey,
  file: File,
  cancelSignal: AbortSignal
) {
  const handler = (await getStorageHandler(StorageKey.BACKUP, window)) as BackupStorageHandler;

  return replicateData(
    window,
    StorageKey.BACKUP,
    target,
    await handler.setBackupZip(file),
    [StorageDataType.DATA, StorageDataType.PROGRESS],
    cancelSignal
  );
}

export async function replicateData(
  window: Window,
  source: StorageKey,
  target: StorageKey,
  contexts: ReplicationContext[],
  dataToReplicate: StorageDataType[],
  cancelSignal: AbortSignal
) {
  const db = await database.db;

  if (!db) {
    throw new Error('Unable to get Database');
  }

  const [sourceHandler, targetHandler] = await Promise.all([
    getStorageHandler(source, window),
    getStorageHandler(target, window)
  ]);
  const baseProgress = dataToReplicate.length * 200 + 100; // source retrieval -> target storage per data type + cover
  const maxProgress = baseProgress * contexts.length;
  const isBrowserTarget = target === StorageKey.BROWSER;
  const processBookData = dataToReplicate.includes(StorageDataType.DATA);
  const processProgressData = dataToReplicate.includes(StorageDataType.PROGRESS);

  replicationProgress$.next({ baseProgress, maxProgress });

  const replicationLimiter = pLimit(1);
  const replicationTasks: Promise<void>[] = [];

  let errorMessage = '';
  let processed = 0;

  await persistStorage(target);

  targetHandler.scheduleReporter();

  contexts.forEach((context) =>
    replicationTasks.push(
      replicationLimiter(async () => {
        try {
          throwIfAborted(cancelSignal);

          let dataProcessed = false;

          if (processBookData) {
            const bookData = await sourceHandler.getBookData(context, isBrowserTarget);

            reportProgressStep(cancelSignal);

            if (bookData) {
              await targetHandler.saveBook(bookData, context.title, cancelSignal);
              dataProcessed = true;
              database.dataListChanged$.next();
            }

            reportProgressStep(cancelSignal, dataToReplicate.length === 1);
          }

          if (processProgressData) {
            const progressData = await sourceHandler.getProgressData(context, isBrowserTarget);

            reportProgressStep(cancelSignal, !dataProcessed);

            if (progressData) {
              await targetHandler.saveProgress(context, progressData);
              dataProcessed = true;
              database.bookmarksChanged$.next();
            }

            reportProgressStep(cancelSignal, !dataProcessed);
          }

          if (dataProcessed) {
            await targetHandler.saveCover(context);
          }

          reportProgressStep(cancelSignal);

          processed += 1;
        } catch (error: any) {
          errorMessage = handleErrorDuringReplication(
            error,
            `Error Processing ${context.title}: `,
            [replicationLimiter]
          );
        }
      })
    )
  );

  await Promise.all(replicationTasks).catch(() => {});

  if (targetHandler instanceof BackupStorageHandler) {
    await targetHandler.createExportZip(document, cancelSignal.aborted || !processed);
  }

  targetHandler.scheduleReporter(false);

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

function reportProgressStep(cancelSignal: AbortSignal, allowCancel = true) {
  if (allowCancel) {
    throwIfAborted(cancelSignal);
  }

  replicationProgress$.next({ progressToAdd: 100 });
}
