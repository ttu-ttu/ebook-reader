/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { BaseStorageHandler, FilePrefix } from '$lib/data/storage/handler/base-handler';
import type {
  BooksDbAudioBook,
  BooksDbBookData,
  BooksDbBookmarkData,
  BooksDbReadingGoal,
  BooksDbStatistic,
  BooksDbSubtitleData
} from '$lib/data/database/books-db/versions/books-db';
import { database, lastReadingGoalsModified$ } from '$lib/data/store';

import type { MergeMode } from '$lib/data/merge-mode';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import { StorageDataType } from '$lib/data/storage/storage-types';

export class BrowserStorageHandler extends BaseStorageHandler {
  updateSettings(
    window: Window,
    isForBrowser: boolean,
    saveBehavior: ReplicationSaveBehavior,
    statisticsMergeMode: MergeMode,
    readingGoalsMergeMode: MergeMode
  ) {
    this.window = window;
    this.isForBrowser = isForBrowser;
    this.saveBehavior = saveBehavior;
    this.statisticsMergeMode = statisticsMergeMode;
    this.readingGoalsMergeMode = readingGoalsMergeMode;
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
        `Placeholder books should be opened from their original source${
          book.storageSource ? ` - last source: ${book.storageSource}` : ''
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

  async getFilenameForRecentCheck(fileIdentifier: string) {
    if (this.saveBehavior === ReplicationSaveBehavior.Overwrite) {
      BaseStorageHandler.reportProgress();
      return undefined;
    }

    let fileName: string | undefined;

    if (fileIdentifier === 'bookdata_') {
      const book = await database.getDataByTitle(this.currentContext.title);

      fileName = book ? BaseStorageHandler.getBookFileName(book) : undefined;
    } else if (fileIdentifier === 'progress_') {
      const progress = await this.getProgress();

      fileName = progress ? BaseStorageHandler.getProgressFileName(progress) : undefined;
    } else if (fileIdentifier === 'statistics_') {
      const lastStatisticModifed = await database.getLastModifiedForType(
        this.currentContext.title,
        StorageDataType.STATISTICS
      );

      fileName = lastStatisticModifed
        ? BaseStorageHandler.getStatisticsFileName([], lastStatisticModifed)
        : undefined;
    } else if (fileIdentifier === BaseStorageHandler.readingGoalsFilePrefix) {
      const lastGoalModified = lastReadingGoalsModified$.getValue();

      fileName = lastGoalModified
        ? BaseStorageHandler.getReadingGoalsFileName(lastGoalModified)
        : undefined;
    } else if (fileIdentifier === FilePrefix.AUDIO_BOOK) {
      const audioBook = await this.getAudioBook();

      fileName = audioBook ? BaseStorageHandler.getAudioBookFileName(audioBook) : undefined;
    } else if (fileIdentifier === FilePrefix.SUBTITLE) {
      const subtitleData = await this.getSubtitleData();

      fileName = subtitleData
        ? BaseStorageHandler.getSubtitleDataFileName(subtitleData)
        : undefined;
    }

    BrowserStorageHandler.reportProgress(0.5);
    BrowserStorageHandler.completeStep();

    return fileName;
  }

  async isBookPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return false;
    }

    const book = await database.getDataByTitle(this.currentContext.title);

    BrowserStorageHandler.reportProgress(0.5);

    let isPresentAndUpToDate = false;

    if (book) {
      const { lastBookModified, lastBookOpen } =
        BaseStorageHandler.getBookMetadata(referenceFilename);
      const { lastBookModified: existingBookModified, lastBookOpen: existingBookOpen } = book;

      isPresentAndUpToDate = !!(
        existingBookModified &&
        lastBookModified &&
        existingBookModified >= lastBookModified &&
        (existingBookOpen || 0) >= (lastBookOpen || 0)
      );
    }

    BrowserStorageHandler.reportProgress(0.5);
    return isPresentAndUpToDate;
  }

  async isProgressPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return false;
    }

    const progress = await this.getProgress();
    const fileName = progress ? BaseStorageHandler.getProgressFileName(progress) : undefined;

    return BaseStorageHandler.checkIsPresentAndUpToDate(
      BaseStorageHandler.getProgressMetadata,
      'lastBookmarkModified',
      referenceFilename,
      fileName
    );
  }

  async areStatisticsPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return false;
    }

    const existingLastModified = await database.getLastModifiedForType(
      this.currentContext.title,
      StorageDataType.STATISTICS
    );
    const fileName = existingLastModified
      ? BaseStorageHandler.getStatisticsFileName([], existingLastModified)
      : undefined;

    BaseStorageHandler.reportProgress();

    return BaseStorageHandler.checkIsPresentAndUpToDate(
      BaseStorageHandler.getStatisticsMetadata,
      'lastStatisticModified',
      referenceFilename,
      fileName
    );
  }

  async isAudioBookPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();

      return false;
    }

    const audioBook = await this.getAudioBook();
    const fileName = audioBook ? BaseStorageHandler.getAudioBookFileName(audioBook) : undefined;

    return BaseStorageHandler.checkIsPresentAndUpToDate<BooksDbAudioBook>(
      BaseStorageHandler.getAudioBookMetadata,
      'lastAudioBookModified',
      referenceFilename,
      fileName
    );
  }

  async isSubtitleDataPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();

      return false;
    }

    const subtitleData = await this.getSubtitleData();
    const fileName = subtitleData
      ? BaseStorageHandler.getSubtitleDataFileName(subtitleData)
      : undefined;

    return BaseStorageHandler.checkIsPresentAndUpToDate<BooksDbSubtitleData>(
      BaseStorageHandler.getSubtitleDataMetadata,
      'lastSubtitleDataModified',
      referenceFilename,
      fileName
    );
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

  async getStatistics() {
    const statistics = await database.getStatisticsForBook(this.currentContext.title);

    BaseStorageHandler.reportProgress(0.5);

    const lastStatisticModified = await database.getLastModifiedForType(
      this.currentContext.title,
      StorageDataType.STATISTICS
    );

    if (!lastStatisticModified) {
      return { statistics: undefined, lastStatisticModified: 0 };
    }

    return { statistics, lastStatisticModified };
  }

  async getCover() {
    const cover =
      this.currentContext.imagePath instanceof Blob ? this.currentContext.imagePath : undefined;

    BaseStorageHandler.reportProgress();

    return cover;
  }

  async getAudioBook() {
    const audioBook = await database.getAudioBook(this.currentContext.title);

    BaseStorageHandler.reportProgress();

    return audioBook;
  }

  async getSubtitleData() {
    const subtitleData = await database.getSubtitleData(this.currentContext.title);

    BaseStorageHandler.reportProgress();

    return subtitleData;
  }

  async saveBook(
    data: Omit<BooksDbBookData, 'id'> | File,
    skipTimestampFallback = true,
    removeStorageContext = true
  ) {
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

      await database.putBookmark(bookmarkData);
    }
  }

  async saveStatistics(data: BooksDbStatistic[], lastStatisticModified: number) {
    await database.storeStatistics(
      this.currentContext.title,
      data,
      this.saveBehavior,
      this.statisticsMergeMode,
      lastStatisticModified
    );

    BaseStorageHandler.reportProgress();
  }

  async saveReadingGoals(data: BooksDbReadingGoal[], lastGoalModified: number) {
    await database.storeReadingGoals(
      data,
      this.saveBehavior,
      this.readingGoalsMergeMode,
      lastGoalModified
    );

    BaseStorageHandler.reportProgress();
  }

  saveCover(data: Blob | undefined) {
    if (data instanceof Blob && this.titleToBookCard.has(this.currentContext.title)) {
      this.addBookCard(this.currentContext.title, { imagePath: data });
    }

    BaseStorageHandler.reportProgress();
    return Promise.resolve();
  }

  areReadingGoalsPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return Promise.resolve(false);
    }

    const existingLastModified = lastReadingGoalsModified$.getValue();
    const fileName = existingLastModified
      ? BaseStorageHandler.getReadingGoalsFileName(existingLastModified)
      : undefined;

    BaseStorageHandler.reportProgress();

    return Promise.resolve(
      BaseStorageHandler.checkIsPresentAndUpToDate(
        BaseStorageHandler.getReadingGoalsMetadata,
        'lastGoalModified',
        referenceFilename,
        fileName
      )
    );
  }

  async getReadingGoals() {
    const readingGoals = await database.getReadingGoals();
    const lastGoalModified = lastReadingGoalsModified$.getValue();

    BaseStorageHandler.reportProgress();

    if (!lastGoalModified) {
      return { readingGoals: undefined, lastGoalModified: 0 };
    }

    return { readingGoals, lastGoalModified };
  }

  async saveAudioBook(data: BooksDbAudioBook | File) {
    if (data instanceof File) {
      BaseStorageHandler.reportProgress();

      return;
    }

    await database.putAudioBook(data);
  }

  async saveSubtitleData(data: BooksDbSubtitleData | File) {
    if (data instanceof File) {
      BaseStorageHandler.reportProgress();

      return;
    }

    await database.putSubtitleData(data);
  }

  async deleteBookData(
    booksToDelete: string[],
    cancelSignal: AbortSignal,
    keepLocalStatistics: boolean
  ) {
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
      .deleteData(ids, idToTitle, cancelSignal, keepLocalStatistics)
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
