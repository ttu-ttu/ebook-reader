/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Resets a book's reading position to the start. Not part of upstream.
 *
 * Instead of deleting the progress file, a new bookmark at the start is saved
 * with the current time, so it is newer than any copy cached on other devices
 * and they adopt the reset instead of uploading their old position again.
 */

import type { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
import { database } from '$lib/data/store';

export async function clearReadingProgress(handler: BaseStorageHandler, title: string) {
  const localBook = await database.getDataByTitle(title);
  const startBookmark: BooksDbBookmarkData = {
    dataId: localBook?.id ?? 0,
    exploredCharCount: 0,
    progress: 0,
    lastBookmarkModified: Date.now()
  };

  handler.startContext({ title, id: localBook?.id });
  await handler.saveProgress({ ...startBookmark });

  // The browser keeps its own copy of books from other sources.
  if (localBook?.id) {
    await database.putBookmark(startBookmark);
  }
}
