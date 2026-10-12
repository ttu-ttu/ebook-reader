/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Downloads the signed-in account's statistics and reading goals for every book,
 * not only the ones opened in this browser. Not part of upstream.
 */

// The factory first: the handlers import each other in a cycle.
import '$lib/data/storage/storage-handler-factory';
import { BrowserStorageHandler } from '$lib/data/storage/handler/browser-handler';
import { CalibreStorageHandler } from '$lib/data/storage/handler/calibre-handler';
import { StorageDataType, StorageKey } from '$lib/data/storage/storage-types';
import {
  readingGoalsMergeMode$,
  replicationSaveBehavior$,
  statisticsMergeMode$
} from '$lib/data/store';
import { replicateData } from '$lib/functions/replication/replicator';

export async function pullAccountStatistics(window: Window) {
  // Own handlers: the shared ones switch context while a book opens or the library syncs.
  const calibre = new CalibreStorageHandler(window);
  const titles = await calibre.listAccountTitles();

  if (!titles.length) {
    return;
  }

  const browser = new BrowserStorageHandler(window, StorageKey.BROWSER);

  browser.updateSettings(
    window,
    true,
    replicationSaveBehavior$.getValue(),
    statisticsMergeMode$.getValue(),
    readingGoalsMergeMode$.getValue()
  );
  const error = await replicateData(
    calibre,
    browser,
    false,
    titles.map((title) => ({ title })),
    [StorageDataType.STATISTICS, StorageDataType.READING_GOALS]
  );

  if (error) {
    throw new Error(error);
  }
}
