/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { StorageKey } from '$lib/data/storage-manager/storage-source';
import { getStorageHandler } from '$lib/data/storage-manager/storage-manager-factory';
import { handleErrorDuringReplication } from '$lib/functions/replication/error-handler';
import loadEpub from '$lib/functions/file-loaders/epub/load-epub';
import loadHtmlz from '$lib/functions/file-loaders/htmlz/load-htmlz';
import pLimit from 'p-limit';
import { replicationProgress$ } from '$lib/functions/replication/replication-progress';
import { throwIfAborted } from '$lib/functions/replication/replication-error';

export async function addBooks(
  files: File[],
  window: Window,
  document: Document,
  cancelSignal: AbortSignal
) {
  const replicationHandler = await getStorageHandler(StorageKey.BROWSER, window);
  const baseProgress = 200; // load -> save;
  const maxProgress = baseProgress * files.length;
  const dataIds: number[] = [];
  const limiter = pLimit(1);
  const tasks: Promise<void>[] = [];
  const lastBookModified = new Date().getTime();

  let errorMessage = '';

  replicationProgress$.next({ progressToAdd: 0, baseProgress, maxProgress });

  files.forEach((file) =>
    tasks.push(
      limiter(async () => {
        let currentTitle = file.name;

        try {
          throwIfAborted(cancelSignal);

          const bookContent = await (file.name.endsWith('.epub')
            ? loadEpub(file, document, lastBookModified)
            : loadHtmlz(file, document, lastBookModified));

          replicationProgress$.next({ progressToAdd: 100 });
          currentTitle = bookContent.title;

          dataIds.push(await replicationHandler.addBook(bookContent));
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
