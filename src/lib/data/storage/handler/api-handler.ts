/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbAudioBook,
  BooksDbBookData,
  BooksDbBookmarkData,
  BooksDbReadingGoal,
  BooksDbStatistic,
  BooksDbSubtitleData
} from '$lib/data/database/books-db/versions/books-db';
import { logger } from '$lib/data/logger';
import { MergeMode } from '$lib/data/merge-mode';
import { mergeReadingGoals, readingGoalSortFunction } from '$lib/data/reading-goal';
import {
  BaseStorageHandler,
  FilePrefix,
  type ExternalFile
} from '$lib/data/storage/handler/base-handler';
import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
import { StorageOAuthManager } from '$lib/data/storage/storage-oauth-manager';
import { StorageKey } from '$lib/data/storage/storage-types';
import { database } from '$lib/data/store';
import {
  convertAuthErrorResponse,
  handleErrorDuringReplication
} from '$lib/functions/replication/error-handler';
import { AbortError, throwIfAborted } from '$lib/functions/replication/replication-error';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import { replicationProgress$ } from '$lib/functions/replication/replication-progress';
import { mergeStatistics, updateStatisticToStore } from '$lib/functions/statistic-util';
import pLimit from 'p-limit';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: XMLHttpRequestBodyInit | null | undefined;
  trackDownload?: boolean;
  trackUpload?: boolean;
  skipAuth?: boolean;
}

export abstract class ApiStorageHandler extends BaseStorageHandler {
  protected abstract setInternalSettings(storageSourceName: string): void;

  protected abstract ensureTitle(
    name?: string,
    parent?: string,
    readOnly?: boolean
  ): Promise<string>;

  protected abstract getExternalFiles(remoteTitleId: string): Promise<ExternalFile[]>;

  protected abstract setRootFiles(): Promise<void>;

  protected abstract retrieve(
    file: ExternalFile,
    typeToRetrieve: XMLHttpRequestResponseType,
    progressBase?: number
  ): Promise<any>;

  protected abstract upload(
    folderId: string,
    name: string,
    files: ExternalFile[],
    externalFile: ExternalFile | undefined,
    data: Blob | string | undefined,
    rootFilePrefix?: string,
    progressBase?: number
  ): Promise<ExternalFile>;

  protected abstract executeDelete(id: string): Promise<void>;

  protected authManager: StorageOAuthManager;

  protected rootId = '';

  protected titleToId = new Map<string, string>();

  protected titleToFiles = new Map<string, ExternalFile[]>();

  constructor(storageType: StorageKey, window: Window, refreshEndpoint: string) {
    super(window, storageType);
    this.authManager = new StorageOAuthManager(this.storageType, refreshEndpoint);
  }

  updateSettings(
    window: Window,
    isForBrowser: boolean,
    saveBehavior: ReplicationSaveBehavior,
    statisticsMergeMode: MergeMode,
    readingGoalsMergeMode: MergeMode,
    cacheStorageData: boolean,
    askForStorageUnlock: boolean,
    storageSourceName: string
  ) {
    this.window = window;
    this.isForBrowser = isForBrowser;
    this.saveBehavior = saveBehavior;
    this.cacheStorageData = cacheStorageData;
    this.askForStorageUnlock = askForStorageUnlock;
    this.statisticsMergeMode = statisticsMergeMode;
    this.readingGoalsMergeMode = readingGoalsMergeMode;
    this.setInternalSettings(storageSourceName);
  }

  clearData(clearAll = true) {
    this.titleToFiles.clear();
    this.rootFiles.clear();
    this.rootFileListFetched = false;

    if (clearAll) {
      this.rootId = '';
      this.titleToId.clear();
      this.titleToBookCard.clear();
      this.dataListFetched = false;
    }
  }

  async prepareBookForReading(): Promise<number> {
    const data = await database.getDataByTitle(this.currentContext.title);

    let idToReturn = 0;
    let bookData: Omit<BooksDbBookData, 'id'> | undefined = data;

    if (!bookData || !bookData.elementHtml) {
      const { file } = await this.getExternalFile('bookdata_');

      bookData = file
        ? bookData || {
            title: this.currentContext.title,
            styleSheet: '',
            elementHtml: '',
            blobs: {},
            coverImage: '',
            hasThumb: true,
            characters: 0,
            sections: [],
            lastBookModified: 0,
            lastBookOpen: 0,
            storageSource: undefined
          }
        : undefined;
    }

    if (!bookData) {
      throw new Error('No local or external book data found');
    }

    if (bookData.storageSource !== this.storageSourceName) {
      bookData.storageSource = this.storageSourceName;

      idToReturn = await getStorageHandler(
        this.window,
        StorageKey.BROWSER,
        undefined,
        true,
        this.cacheStorageData,
        ReplicationSaveBehavior.Overwrite
      ).saveBook(bookData, true, false);
    } else if (data?.id) {
      idToReturn = data.id;
    }

    return idToReturn;
  }

  async updateLastRead(book: BooksDbBookData) {
    const { titleId, files, file } = await this.getExternalFile('bookdata_');

    if (!file) {
      return;
    }

    const filename = BaseStorageHandler.getBookFileName(book);
    const { characters, lastBookModified, lastBookOpen } =
      BaseStorageHandler.getBookMetadata(filename);

    await this.upload(titleId, filename, files, file, undefined);

    this.addBookCard(this.currentContext.title, { characters, lastBookModified, lastBookOpen });
  }

  async getFilenameForRecentCheck(fileIdentifier: string) {
    if (this.saveBehavior === ReplicationSaveBehavior.Overwrite) {
      BaseStorageHandler.reportProgress();
      return undefined;
    }

    const { file } = this.validRootFiles.includes(fileIdentifier)
      ? await this.getRootFile(fileIdentifier)
      : await this.getExternalFile(fileIdentifier);

    BaseStorageHandler.completeStep();

    return file?.name;
  }

  async isBookPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return false;
    }

    const { file } = await this.getExternalFile('bookdata_');

    let isPresentAndUpToDate = false;

    if (file) {
      const { lastBookModified, lastBookOpen } =
        BaseStorageHandler.getBookMetadata(referenceFilename);
      const { lastBookModified: existingBookModified, lastBookOpen: existingBookOpen } =
        BaseStorageHandler.getBookMetadata(file.name);

      isPresentAndUpToDate = !!(
        existingBookModified &&
        lastBookModified &&
        existingBookModified >= lastBookModified &&
        (existingBookOpen || 0) >= (lastBookOpen || 0)
      );
    }

    BaseStorageHandler.completeStep();

    return isPresentAndUpToDate;
  }

  async isProgressPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return false;
    }

    const { file } = await this.getExternalFile('progress_');

    return BaseStorageHandler.checkIsPresentAndUpToDate(
      BaseStorageHandler.getProgressMetadata,
      'lastBookmarkModified',
      referenceFilename,
      file?.name
    );
  }

  async areStatisticsPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return false;
    }

    const { file } = await this.getExternalFile('statistics_');

    return BaseStorageHandler.checkIsPresentAndUpToDate(
      BaseStorageHandler.getStatisticsMetadata,
      'lastStatisticModified',
      referenceFilename,
      file?.name
    );
  }

  async areReadingGoalsPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();
      return false;
    }

    const { file } = await this.getRootFile(BaseStorageHandler.readingGoalsFilePrefix);

    return BaseStorageHandler.checkIsPresentAndUpToDate(
      BaseStorageHandler.getReadingGoalsMetadata,
      'lastGoalModified',
      referenceFilename,
      file?.name
    );
  }

  async isAudioBookPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();

      return false;
    }

    const { file } = await this.getExternalFile(FilePrefix.AUDIO_BOOK);

    return BaseStorageHandler.checkIsPresentAndUpToDate<BooksDbAudioBook>(
      BaseStorageHandler.getAudioBookMetadata,
      'lastAudioBookModified',
      referenceFilename,
      file?.name
    );
  }

  async isSubtitleDataPresentAndUpToDate(referenceFilename: string | undefined) {
    if (!referenceFilename) {
      BaseStorageHandler.reportProgress();

      return false;
    }

    const { file } = await this.getExternalFile(FilePrefix.SUBTITLE);

    return BaseStorageHandler.checkIsPresentAndUpToDate<BooksDbSubtitleData>(
      BaseStorageHandler.getSubtitleDataMetadata,
      'lastSubtitleDataModified',
      referenceFilename,
      file?.name
    );
  }

  async getBook() {
    const { file, data } = await this.getExternalFile(
      'bookdata_',
      'blob',
      this.isForBrowser ? 0.7 : 1
    );

    if (!file) {
      return undefined;
    }

    return this.isForBrowser
      ? this.extractBookData(data, file.name, 0.3)
      : new File([data], file.name, { type: 'application/zip' });
  }

  async getProgress() {
    const { file, data } = await this.getExternalFile('progress_', 'json');

    if (!file) {
      return undefined;
    }

    return this.isForBrowser
      ? data
      : new File([new Blob([JSON.stringify(data)])], file.name, { type: 'application/json' });
  }

  async getStatistics() {
    const { file, data } = await this.getExternalFile('statistics_', 'json');

    if (!file) {
      return { statistics: undefined, lastStatisticModified: 0 };
    }

    return {
      statistics: data,
      lastStatisticModified: BaseStorageHandler.getStatisticsMetadata(file.name)
        .lastStatisticModified
    };
  }

  async getCover() {
    if (this.currentContext.imagePath instanceof Blob) {
      BaseStorageHandler.reportProgress();

      return this.currentContext.imagePath;
    }

    const { data } = await this.getExternalFile('cover_', 'blob');

    return data;
  }

  async getReadingGoals() {
    const { file, data } = await this.getRootFile(
      BaseStorageHandler.readingGoalsFilePrefix,
      'json'
    );

    if (!file) {
      return { readingGoals: undefined, lastGoalModified: 0 };
    }

    return {
      readingGoals: data,
      lastGoalModified: BaseStorageHandler.getReadingGoalsMetadata(file.name).lastGoalModified
    };
  }

  async getAudioBook() {
    const { file, data } = await this.getExternalFile(FilePrefix.AUDIO_BOOK, 'json');

    if (!file) {
      return undefined;
    }

    return this.isForBrowser
      ? data
      : new File([new Blob([JSON.stringify(data)])], file.name, { type: 'application/json' });
  }

  async getSubtitleData() {
    const { file, data } = await this.getExternalFile(FilePrefix.SUBTITLE, 'json');

    if (!file) {
      return undefined;
    }

    return this.isForBrowser
      ? data
      : new File([new Blob([JSON.stringify(data)])], file.name, { type: 'application/json' });
  }

  async saveBook(data: Omit<BooksDbBookData, 'id'> | File, skipTimestampFallback = true) {
    const { titleId, files, file } = await this.getExternalFile('bookdata_', '', 0.2, false);
    const filename = BaseStorageHandler.getBookFileName(
      data,
      skipTimestampFallback ? '' : file?.name
    );
    const { characters, lastBookModified, lastBookOpen } =
      BaseStorageHandler.getBookMetadata(filename);

    if (file && this.saveBehavior === ReplicationSaveBehavior.NewOnly) {
      const { lastBookModified: existingBookModified, lastBookOpen: existingBookOpen } =
        BaseStorageHandler.getBookMetadata(file.name);

      if (
        existingBookModified &&
        lastBookModified &&
        existingBookModified >= lastBookModified &&
        (existingBookOpen || 0) >= (lastBookOpen || 0)
      ) {
        return 0;
      }
    }

    if (data instanceof File) {
      await this.upload(titleId, filename, files, file, data);
    } else {
      await this.upload(titleId, filename, files, file, await this.zipBookData(data, 0.2), '', 0.6);
    }

    this.addBookCard(this.currentContext.title, { characters, lastBookModified, lastBookOpen });

    return 0;
  }

  async saveProgress(data: File | BooksDbBookmarkData) {
    const filename = BaseStorageHandler.getProgressFileName(data);
    const progressData = data instanceof File ? data : JSON.stringify(data);
    const { titleId, files, file } = await this.getExternalFile('progress_', '', 0.2, false);
    const { lastBookmarkModified, progress } = BaseStorageHandler.getProgressMetadata(filename);

    await this.upload(titleId, filename, files, file, progressData);

    this.addBookCard(this.currentContext.title, { lastBookmarkModified, progress });
  }

  async saveStatistics(statistics: BooksDbStatistic[], lastStatisticModified: number) {
    const isMerge = this.statisticsMergeMode === MergeMode.MERGE;
    const {
      titleId,
      files,
      file,
      data: existingData
    } = await this.getExternalFile('statistics_', isMerge ? 'json' : '', 0.2, false);

    let statisticsToStore: BooksDbStatistic[] = statistics;
    let newStatisticModified = lastStatisticModified;

    if (isMerge) {
      statisticsToStore = mergeStatistics(
        statistics,
        existingData,
        this.saveBehavior === ReplicationSaveBehavior.NewOnly
      );
    }

    ({ statisticsToStore, newStatisticModified } = updateStatisticToStore(
      statisticsToStore,
      newStatisticModified
    ));

    const filename = BaseStorageHandler.getStatisticsFileName(
      statisticsToStore,
      newStatisticModified
    );

    await this.upload(titleId, filename, files, file, JSON.stringify(statisticsToStore));

    this.addBookCard(this.currentContext.title, {});
  }

  async saveCover(data: Blob | undefined) {
    if (!data) {
      BaseStorageHandler.reportProgress();
      return;
    }

    const { titleId, files, file } = await this.getExternalFile('cover_', '', 0.2, false);

    if (!file?.id) {
      const filename = await BaseStorageHandler.getCoverFileName(data);

      await this.upload(titleId, filename, files, undefined, data);
    }

    if (this.titleToBookCard.has(this.currentContext.title)) {
      this.addBookCard(this.currentContext.title, { imagePath: data });
    }
  }

  async saveReadingGoals(readingGoals: BooksDbReadingGoal[], lastGoalModified: number) {
    const isMerge = this.readingGoalsMergeMode === MergeMode.MERGE;
    const { file, data: existingData } = await this.getRootFile(
      BaseStorageHandler.readingGoalsFilePrefix,
      isMerge ? 'json' : '',
      0.2
    );

    let readingGoalsToStore: BooksDbReadingGoal[] = readingGoals;
    let newReadingGoalModified = lastGoalModified;

    if (isMerge) {
      ({ readingGoalsToStore, newReadingGoalModified } = mergeReadingGoals(
        readingGoals,
        existingData,
        this.saveBehavior === ReplicationSaveBehavior.NewOnly,
        lastGoalModified
      ));
    }

    const filename = BaseStorageHandler.getReadingGoalsFileName(newReadingGoalModified);

    readingGoalsToStore.sort(readingGoalSortFunction);

    await this.upload(
      this.rootId,
      filename,
      [],
      file,
      JSON.stringify(readingGoalsToStore),
      BaseStorageHandler.readingGoalsFilePrefix
    );
  }

  async saveAudioBook(data: BooksDbAudioBook | File) {
    const filename = BaseStorageHandler.getAudioBookFileName(data);
    const audioBookData = data instanceof File ? data : JSON.stringify(data);
    const { titleId, files, file } = await this.getExternalFile(
      FilePrefix.AUDIO_BOOK,
      '',
      0.2,
      false
    );

    await this.upload(titleId, filename, files, file, audioBookData);
  }

  async saveSubtitleData(data: BooksDbSubtitleData | File) {
    const filename = BaseStorageHandler.getSubtitleDataFileName(data);
    const subtitleData = data instanceof File ? data : JSON.stringify(data);
    const { titleId, files, file } = await this.getExternalFile(
      FilePrefix.SUBTITLE,
      '',
      0.2,
      false
    );

    await this.upload(titleId, filename, files, file, subtitleData);
  }

  async deleteBookData(booksToDelete: string[], cancelSignal: AbortSignal) {
    await this.ensureTitle();

    let error = '';

    const deleted: number[] = [];
    const deletionLimiter = pLimit(1);
    const deleteTasks: Promise<void>[] = [];

    replicationProgress$.next({ progressBase: 1, maxProgress: booksToDelete.length });

    booksToDelete.forEach((bookToDelete) =>
      deleteTasks.push(
        deletionLimiter(async () => {
          try {
            throwIfAborted(cancelSignal);

            const externalId = this.titleToId.get(bookToDelete);

            if (externalId) {
              await this.executeDelete(externalId);
            }

            this.titleToFiles.delete(bookToDelete);

            const deletedBookCard = this.titleToBookCard.get(bookToDelete);

            if (deletedBookCard) {
              deleted.push(deletedBookCard.id);
            }

            this.titleToId.delete(bookToDelete);
            this.titleToBookCard.delete(bookToDelete);

            database.dataListChanged$.next(this);

            BaseStorageHandler.reportProgress();
          } catch (err) {
            error = handleErrorDuringReplication(err, `Error deleting ${bookToDelete}: `, [
              deletionLimiter
            ]);
          }
        })
      )
    );

    await Promise.all(deleteTasks).catch(() => {});

    return { error, deleted };
  }

  protected async request(
    url: string,
    options: RequestOptions = {},
    type: XMLHttpRequestResponseType = 'json',
    progressBase = 1
  ): Promise<any> {
    const token = await (options.skipAuth
      ? Promise.resolve('')
      : this.authManager.getToken(this.window, this.storageSourceName, this.askForStorageUnlock));
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.responseType = type;

      xhr.addEventListener('abort', () => {
        reject(new AbortError());
      });

      if (options.trackDownload) {
        this.currentLastProgressValue = 0;
        this.currentProgressBase = progressBase;

        xhr.onprogress = (event: ProgressEvent) => {
          if (self.cancelSignal?.aborted) {
            xhr.abort();
            return;
          }

          if (event.lengthComputable) {
            self.reportFunction(event.loaded, event.total);
          }
        };
      }

      if (options.trackUpload) {
        this.currentLastProgressValue = 0;
        this.currentProgressBase = progressBase;

        xhr.upload.onprogress = (event: ProgressEvent) => {
          if (self.cancelSignal?.aborted) {
            xhr.abort();
            return;
          }

          if (event.lengthComputable) {
            self.reportFunction(event.loaded, event.total);
          }
        };
      }

      xhr.addEventListener(
        'readystatechange',
        async function stateHandler() {
          if (this.readyState === 4) {
            if (this.status >= 200 && this.status < 400) {
              resolve(this.response);
            } else {
              const errorMessage = await convertAuthErrorResponse(this);

              if (this.status === 404) {
                logger.error(errorMessage);
                reject(new Error('Resource not found. Refresh your current tab and try again'));
              } else {
                reject(new Error(errorMessage));
              }
            }
          }
        },
        false
      );

      xhr.open(options.method || 'GET', url, true);

      if (options.headers) {
        const entries = Object.entries(options.headers);

        for (let index = 0, { length } = entries; index < length; index += 1) {
          const [headerName, headerValue] = entries[index];

          xhr.setRequestHeader(headerName, headerValue);
        }
      }

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(options.body || null);
    });
  }

  protected async getExternalFile(
    fileIdentifier: string,
    typeToRetrieve: XMLHttpRequestResponseType = '',
    progressBase = 1,
    readOnly = true
  ) {
    const progressPerStep = progressBase / 5;

    await this.ensureTitle();

    BaseStorageHandler.reportProgress(progressPerStep);

    const titleId = await this.ensureTitle(this.currentContext.title, this.rootId, readOnly);

    BaseStorageHandler.reportProgress(progressPerStep);

    if (!titleId) {
      return { titleId: '', file: undefined, files: [], data: undefined };
    }

    const files = await this.getExternalFiles(titleId);
    const file = files.find((entry) => entry.name.startsWith(fileIdentifier));

    BaseStorageHandler.reportProgress(progressPerStep);

    if (!file) {
      return { titleId, file: undefined, files, data: undefined };
    }

    let data;

    if (typeToRetrieve) {
      data = await this.retrieve(file, typeToRetrieve, progressPerStep * 2);
    }

    return { titleId, file, files, data };
  }

  protected async getRootFile(
    fileIdentifier: string,
    typeToRetrieve: XMLHttpRequestResponseType = '',
    progressBase = 1
  ) {
    const progressPerStep = progressBase / 3;

    await this.ensureTitle();

    BaseStorageHandler.reportProgress(progressPerStep);

    await this.setRootFiles();

    const file = this.rootFiles.get(fileIdentifier);

    BaseStorageHandler.reportProgress(progressPerStep);

    if (!file) {
      return { file: undefined, data: undefined };
    }

    let data;

    if (typeToRetrieve) {
      data = await this.retrieve(file, typeToRetrieve, progressPerStep);
    }

    return { file, data };
  }

  protected updateAfterUpload(
    id: string,
    name: string,
    files: ExternalFile[],
    remoteFile: ExternalFile | undefined,
    extraData = {},
    rootFilePrefix?: string
  ) {
    if (rootFilePrefix) {
      this.rootFiles.set(rootFilePrefix, { id, name });
    } else if (remoteFile) {
      const titleFiles = files.map((file) => {
        const updatedFile = file;
        if (file.name === remoteFile.name) {
          updatedFile.name = name;
        }

        return updatedFile;
      });

      this.titleToFiles.set(this.currentContext.title, titleFiles);
    } else {
      files.push({ id, name, ...extraData });

      this.titleToFiles.set(this.currentContext.title, files);
    }
  }
}
