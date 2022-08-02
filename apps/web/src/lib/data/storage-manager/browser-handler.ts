/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { BaseStorageHandler } from '$lib/data/storage-manager/base-handler';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
import type { LoadData } from '$lib/functions/file-loaders/types';
import { database } from '$lib/data/store';

export class BrowserStorageHandler extends BaseStorageHandler {
  private titleToFileData = new Map<string, BookCardProps>();

  async init(window: Window) {
    this.window = window;
  }

  async getDataList(): Promise<BookCardProps[]> {
    if (!this.dataListFetched) {
      const db = await database.db;
      const data = await db.getAll('data');

      for (let index = 0, { length } = data; index < length; index += 1) {
        this.applyUpsert(data[index]);
      }

      this.dataListFetched = true;
    }

    return [...this.titleToFileData.values()];
  }

  async addBook(book: LoadData) {
    return database.upsertData(book, this);
  }

  applyUpsert(book: BooksDbBookData) {
    const existingFileData = this.titleToFileData.get(book.title) || ({} as BookCardProps);

    existingFileData.id = book.id;
    existingFileData.title = book.title;
    existingFileData.imagePath = book.coverImage || '';
    existingFileData.progress = 0;

    this.titleToFileData.set(book.title, existingFileData);
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
}
