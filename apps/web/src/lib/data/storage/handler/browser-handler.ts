/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookData,
  BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';

import { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import { database } from '$lib/data/store';

export class BrowserStorageHandler extends BaseStorageHandler {
  updateSettings(window: Window, isForBrowser: boolean, saveBehavior: ReplicationSaveBehavior) {
    this.window = window;
    this.isForBrowser = isForBrowser;
    this.saveBehavior = saveBehavior;
  }

  async getBookList() {
    if (!this.dataListFetched) {
      database.listLoading$.next(true);

      try {
        const db = await database.db;
        const data = await db.getAll('data');

        for (let index = 0, { length } = data; index < length; index += 1) {
          const book = data[index];

          this.addBookCard(book.title, {
            id: book.id,
            imagePath: book.coverImage || '',
            characters: BaseStorageHandler.getBookCharacters(
              book.characters || 0,
              book.sections || []
            ),
            lastBookModified: book.lastBookModified || 0,
            lastBookOpen: book.lastBookOpen || 0,
            isPlaceholder: !book.elementHtml
          });
        }

        this.dataListFetched = true;
      } catch (error) {
        this.clearData();
        throw error;
      }
    }

    return [...this.titleToBookCard.values()];
  }

  clearData(clearAll = true) {
    if (clearAll) {
      this.titleToBookCard.clear();
      this.dataListFetched = false;
    }
  }

  async prepareBookForReading() {
    const book = this.currentContext.id
      ? await database.getData(this.currentContext.id)
      : await database.getDataByTitle(this.currentContext.title);

    if (!book) {
      throw new Error('No local book data found');
    }

    if (!book.elementHtml) {
      throw new Error(
        `Placeholder books should be opened from their original source${book.storageSource ? ` - last source: ${book.storageSource}` : ''
        }`
      );
    }

    if (book.storageSource) {
      await database.upsertData(book, ReplicationSaveBehavior.Overwrite);
    }

    return book.id;
  }

  async updateLastRead(book: BooksDbBookData) {
    const filename = BaseStorageHandler.getBookFileName(book);
    const { characters, lastBookModified, lastBookOpen } =
      BaseStorageHandler.getBookMetadata(filename);
    const db = await database.db;

    await db.put('data', book);

    this.addBookCard(this.currentContext.title, { characters, lastBookModified, lastBookOpen });
  }

  async getBook() {
    const book = this.currentContext.id
      ? await database.getData(this.currentContext.id)
      : await database.getDataByTitle(this.currentContext.title);

    BaseStorageHandler.reportProgress();

    return book;
  }

  async getProgress() {
    const dataId =
      this.currentContext.id || (await database.getDataByTitle(this.currentContext.title))?.id;

    BaseStorageHandler.reportProgress(0.5);

    const progress = dataId ? await database.getBookmark(dataId) : undefined;

    return progress;
  }

  async getCover() {
    const cover =
      this.currentContext.imagePath instanceof Blob ? this.currentContext.imagePath : undefined;

    BaseStorageHandler.reportProgress();

    return cover;
  }

  async saveBook(
    data: Omit<BooksDbBookData, 'id'> | File,
    skipTimestampFallback = true,
    removeStorageContext = true) {
    let idToReturn = 0;

    if (!(data instanceof File)) {
      const storedBookData = await database.upsertData(
        data,
        this.saveBehavior,
        skipTimestampFallback,
        removeStorageContext
      );

      idToReturn = storedBookData.id;
      this.addBookCard(data.title, {
        id: storedBookData.id,
        characters: BaseStorageHandler.getBookCharacters(
          storedBookData.characters || 0,
          storedBookData.sections || []
        ),
        lastBookModified: storedBookData.lastBookModified || 0,
        lastBookOpen: storedBookData.lastBookOpen || 0,
        isPlaceholder: !storedBookData.elementHtml
      });
    }

    BaseStorageHandler.reportProgress();

    return idToReturn;
  }

  async saveProgress(data: BooksDbBookmarkData | File) {
    if (data instanceof File) {
      BaseStorageHandler.reportProgress();

      return;
    }

    const dataId =
      this.currentContext.id || (await database.getDataByTitle(this.currentContext.title))?.id;

    BaseStorageHandler.reportProgress(0.5);

    if (dataId) {
      const bookmarkData = data;

      bookmarkData.dataId = dataId;

      await database.putBookmark(bookmarkData, this.saveBehavior);
    }
  }

  saveCover(data: Blob | undefined) {
    if (data instanceof Blob && this.titleToBookCard.has(this.currentContext.title)) {
      this.addBookCard(this.currentContext.title, { imagePath: data });
    }

    BaseStorageHandler.reportProgress();
    return Promise.resolve();
  }

  /* eslint-disable class-methods-use-this */
  getFilenameForRecentCheck() {
    BrowserStorageHandler.reportProgress();
    return Promise.resolve(undefined);
  }

  isBookPresentAndUpToDate() {
    BrowserStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  isProgressPresentAndUpToDate() {
    BrowserStorageHandler.reportProgress();
    return Promise.resolve(false);
  }
  /* eslint-enable class-methods-use-this */

  async deleteBookData(booksToDelete: string[], cancelSignal: AbortSignal) {
    const ids: number[] = [];
    const idToTitle = new Map<number, string>();

    for (let index = 0, { length } = booksToDelete; index < length; index += 1) {
      const bookData = this.titleToBookCard.get(booksToDelete[index]);

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

      this.titleToBookCard.delete(idToTitle.get(result) || '');
    }

    if (deleted.length) {
      database.dataListChanged$.next(this);
    }

    return { error, deleted };
  }
}
