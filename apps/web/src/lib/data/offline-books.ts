/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Keeps the books on Home (My books and Continue reading) downloaded to the browser,
 * so they open offline. Not visual novels: their games can be large and folder games
 * are fetched by URL anyway.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { CalibreStorageHandler } from '$lib/data/storage/handler/calibre-handler';
import { isContinueReading } from '$lib/data/library-home';
import { logger } from '$lib/data/logger';
import { database } from '$lib/data/store';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import { MergeMode } from '$lib/data/merge-mode';

let pending: string[] | undefined;
let running: Promise<void> | undefined;

/** Titles of the Home books to keep in the browser. */
export function homeOfflineTitles(
  cards: BookCardProps[],
  homeTitles: string[],
  removed: Record<string, number>
) {
  const onHome = new Set(homeTitles);

  return cards
    .filter((card) => !card.vn && (onHome.has(card.title) || isContinueReading(card, removed)))
    .map((card) => card.title);
}

/**
 * Downloads (or processes, if no device has yet) the books not in the browser, one at a
 * time in the background. A new call while it runs replaces the titles still to check.
 */
export function keepBooksOffline(window: Window, titles: string[]) {
  pending = titles;
  running ??= (async () => {
    while (pending) {
      const batch = pending;

      pending = undefined;

      for (const title of batch) {
        if (pending) break;

        await downloadBook(window, title).catch((error) =>
          logger.warn(`Keeping ${title} offline failed: ${error.message}`)
        );
      }
    }
  })().finally(() => {
    running = undefined;
  });

  return running;
}

async function downloadBook(window: Window, title: string) {
  if ((await database.getDataByTitle(title))?.elementHtml) return;

  // Own instance: the shared one switches context while a book opens.
  const handler = new CalibreStorageHandler(window);

  handler.updateSettings(
    window,
    true,
    ReplicationSaveBehavior.NewOnly,
    MergeMode.MERGE,
    MergeMode.MERGE,
    true,
    false,
    ''
  );
  handler.startContext({ id: 0, title, imagePath: '' });
  // Processes the book from Calibre if it never was, else stores a placeholder ...
  await handler.prepareBookForReading();
  // ... that this fills with the processed data.
  await handler.getBook();
}
