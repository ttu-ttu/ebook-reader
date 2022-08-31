/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookData,
  BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';

import { BaseStorageHandler } from '$lib/data/storage-manager/base-handler';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import type { ReplicationContext } from '$lib/functions/replication/replication-progress';
import { database } from '$lib/data/store';

export class BrowserStorageHandler extends BaseStorageHandler {
  async init(window: Window) {
    this.window = window;
  }

  async getDataList(): Promise<BookCardProps[]> {
    if (!this.dataListFetched) {
      const db = await database.db;
      const data = await db.getAll('data');

      for (let index = 0, { length } = data; index < length; index += 1) {
        this.applyUpsert(data[index], data[index].id);
      }

      this.dataListFetched = true;
    }

    return [...this.titleToFileData.values()];
  }

  applyUpsert(book: Omit<BooksDbBookData, 'id'>, id?: number) {
    const existingFileData = this.titleToFileData.get(book.title) || ({} as BookCardProps);

    if (id) {
      existingFileData.id = id;
    }

    existingFileData.title = book.title;
    existingFileData.imagePath = book.coverImage || '';
    existingFileData.lastBookModified = book.lastBookModified || 0;
    existingFileData.lastBookOpen = book.lastBookOpen || 0;
    existingFileData.progress = 0;
    existingFileData.lastBookmarkModified = 0;

    this.titleToFileData.set(book.title, existingFileData);
  }

  async saveBook(book: Omit<BooksDbBookData, 'id'> | File) {
    if (!(book instanceof File)) {
      const storedBookData = await database.upsertData(book);

      this.applyUpsert(storedBookData, storedBookData.id);
      return storedBookData.id;
    }

    return 0;
  }

  // eslint-disable-next-line class-methods-use-this
  async saveProgress(context: ReplicationContext, progress: BooksDbBookmarkData | File) {
    if (progress instanceof File) {
      return;
    }

    const dataId = context.id || (await database.getDataByTitle(context.title))?.id;

    if (dataId) {
      const bookmarkData = progress;

      bookmarkData.dataId = dataId;

      await database.putBookmark(bookmarkData);
    }
  }

  async deleteBookData(booksToDelete: string[], cancelSignal: AbortSignal) {
    const ids: number[] = [];
    const idToTitle = new Map<number, string>();

    for (let index = 0, { length } = booksToDelete; index < length; index += 1) {
      const bookData = this.titleToFileData.get(booksToDelete[index]);

      if (bookData) {
        ids.push(bookData.id);
        idToTitle.set(bookData.id, bookData.title);
      }
    }

    const { error, deleted } = await database
      .deleteData(ids, cancelSignal)
      .catch((catchedError) => ({ error: catchedError.message, deleted: [] }));

    for (let index = 0, { length } = deleted; index < length; index += 1) {
      const result = deleted[index];

      this.titleToFileData.delete(idToTitle.get(result) || '');
    }

    if (deleted.length) {
      database.dataListChanged$.next();
    }

    return [error, deleted];
  }

  /* eslint-disable class-methods-use-this */
  getBookData(context: ReplicationContext) {
    return database.getData(context.id);
  }

  getProgressData(context: ReplicationContext) {
    return database.getBookmark(context.id);
  }

  async saveCover() {
    // no-op
  }
  /* eslint-enable class-methods-use-this */
}
