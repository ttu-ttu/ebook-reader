/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookData,
  BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';
import { logger } from '$lib/data/logger';
import { BaseStorageHandler, type ExternalFile } from '$lib/data/storage/handler/base-handler';
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
import pLimit from 'p-limit';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: XMLHttpRequestBodyInit | null | undefined;
  trackDownload?: boolean;
  trackUpload?: boolean;
}

export abstract class ApiStorageHandler extends BaseStorageHandler {
  protected abstract setInternalSettings(storageSourceName: string): void;

  protected abstract ensureTitle(
    name?: string,
    parent?: string,
    readOnly?: boolean
  ): Promise<string>;

  protected abstract getExternalFiles(remoteTitleId: string): Promise<ExternalFile[]>;

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
    cacheStorageData: boolean,
    askForStorageUnlock: boolean,
    storageSourceName: string
  ) {
    this.window = window;
    this.isForBrowser = isForBrowser;
    this.saveBehavior = saveBehavior;
    this.cacheStorageData = cacheStorageData;
    this.askForStorageUnlock = askForStorageUnlock;
    this.setInternalSettings(storageSourceName);
  }

  clearData(clearAll = true) {
    this.titleToFiles.clear();

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

    const { file } = await this.getExternalFile(fileIdentifier);

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

    if (file && this.saveBehavior === ReplicationSaveBehavior.NewOnly) {
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

    let isPresentAndUpToDate = false;

    if (file && this.saveBehavior === ReplicationSaveBehavior.NewOnly) {
      const { lastBookmarkModified } = BaseStorageHandler.getProgressMetadata(referenceFilename);
      const { lastBookmarkModified: existingBookmarkModified } =
        BaseStorageHandler.getProgressMetadata(file.name);

      isPresentAndUpToDate = !!(
        existingBookmarkModified &&
        lastBookmarkModified &&
        (existingBookmarkModified || 0) >= (lastBookmarkModified || 0)
      );
    }

    BaseStorageHandler.completeStep();

    return isPresentAndUpToDate;
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

  async getCover() {
    if (this.currentContext.imagePath instanceof Blob) {
      BaseStorageHandler.reportProgress();

      return this.currentContext.imagePath;
    }

    const { data } = await this.getExternalFile('cover_', 'blob');

    return data;
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
      await this.upload(titleId, filename, files, file, await this.zipBookData(data, 0.2), 0.6);
    }

    this.addBookCard(this.currentContext.title, { characters, lastBookModified, lastBookOpen });

    return 0;
  }

  async saveProgress(data: File | BooksDbBookmarkData) {
    const filename = BaseStorageHandler.getProgressFileName(data);
    const progressData = data instanceof File ? data : JSON.stringify(data);
    const { titleId, files, file } = await this.getExternalFile('progress_', '', 0.2, false);
    const { lastBookmarkModified, progress } = BaseStorageHandler.getProgressMetadata(filename);

    if (file && this.saveBehavior === ReplicationSaveBehavior.NewOnly) {
      const { lastBookmarkModified: existingBookmarkModified } =
        BaseStorageHandler.getProgressMetadata(file.name);

      if (
        existingBookmarkModified &&
        lastBookmarkModified &&
        (existingBookmarkModified || 0) >= (lastBookmarkModified || 0)
      ) {
        return;
      }
    }

    await this.upload(titleId, filename, files, file, progressData);

    this.addBookCard(this.currentContext.title, { lastBookmarkModified, progress });
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

    await Promise.all(deleteTasks).catch(() => { });

    return { error, deleted };
  }

  protected async request(
    url: string,
    options: RequestOptions = {},
    type: XMLHttpRequestResponseType = 'json',
    progressBase = 1
  ): Promise<any> {
    const token = await this.authManager.getToken(
      this.window,
      this.storageSourceName,
      this.askForStorageUnlock
    );
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

  protected updateAfterUpload(
    id: string,
    name: string,
    files: ExternalFile[],
    remoteFile: ExternalFile | undefined,
    extraData = {}
  ) {
    if (remoteFile) {
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
