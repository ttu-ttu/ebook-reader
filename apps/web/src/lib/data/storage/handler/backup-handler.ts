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
import type { ReplicationContext } from '$lib/functions/replication/replication-progress';
import { BlobReader, BlobWriter, ZipReader, type Entry, type ZipWriter } from '@zip.js/zip.js';

export class BackupStorageHandler extends BaseStorageHandler {
  private exportZipWriter: ZipWriter<Blob> | undefined;

  private importReader: ZipReader<Blob> | undefined;

  private importEntries: Entry[] = [];

  /* eslint-disable class-methods-use-this */
  getBookList() {
    return Promise.resolve([]);
  }

  prepareBookForReading() {
    return Promise.resolve(0);
  }

  updateLastRead() {
    return Promise.resolve();
  }

  getFilenameForRecentCheck() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(undefined);
  }

  isBookPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  isProgressPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  deleteBookData() {
    return Promise.resolve({ error: '', deleted: [] });
  }
  /* eslint-enable class-methods-use-this */

  updateSettings(window: Window, isForBrowser: boolean) {
    this.window = window;
    this.isForBrowser = isForBrowser;
  }

  clearData(clearAll = true) {
    if (clearAll) {
      this.exportZipWriter = undefined;
      this.importReader = undefined;
      this.importEntries = [];
    }
  }

  async setBackupZip(data: Blob) {
    this.importReader = new ZipReader(new BlobReader(data));
    this.importEntries = await this.importReader.getEntries();

    const titles = new Map<string, ReplicationContext>();

    for (let index = 0, { length } = this.importEntries; index < length; index += 1) {
      const entry = this.importEntries[index];
      const sanitizedTitle = entry.filename.split('/')[0];
      const title = BaseStorageHandler.desanitizeFilename(sanitizedTitle);
      const context = titles.get(title) || { title, imagePath: '' };

      if (entry.filename.startsWith(`${sanitizedTitle}/cover_`)) {
        context.imagePath = entry;
      }

      titles.set(title, context);
    }

    return [...titles.values()];
  }

  async getBook() {
    const { zipEntry, filename } = this.findEntry('bookdata_');

    if (!zipEntry) {
      return undefined;
    }

    const bookBlob = await this.readFromZip(
      new BlobWriter(),
      'Unable to read book data',
      zipEntry,
      this.isForBrowser ? 0.3 : 0.9
    );

    return this.isForBrowser
      ? this.extractBookData(bookBlob, filename, 0.6)
      : new File([bookBlob], filename, { type: 'application/zip' });
  }

  async getProgress() {
    const { zipEntry, filename } = this.findEntry('progress_');

    if (!zipEntry) {
      return undefined;
    }

    const progressBlob = await this.readFromZip(
      new BlobWriter(),
      'Unable to read progress data',
      zipEntry,
      this.isForBrowser ? 0.8 : 0.9
    );

    return this.isForBrowser
      ? this.extractProgress(zipEntry, 0.1)
      : new File([progressBlob], filename, { type: 'application/json' });
  }

  async getCover() {
    if (this.currentContext.imagePath instanceof Blob) {
      BaseStorageHandler.reportProgress();

      return this.currentContext.imagePath;
    }

    const { zipEntry } = this.findEntry('cover_');

    if (!zipEntry) {
      return undefined;
    }

    const cover = await this.readFromZip(
      new BlobWriter(),
      'Unable to read cover data',
      zipEntry,
      0.9
    );

    return cover;
  }

  async saveBook(data: Omit<BooksDbBookData, 'id'> | File) {
    const filename = `${this.sanitizedTitle}/${BaseStorageHandler.getBookFileName(data)}`;

    if (data instanceof File) {
      this.exportZipWriter = await this.addDataToZip(filename, data, this.exportZipWriter);
    } else {
      this.exportZipWriter = await this.addDataToZip(
        filename,
        await this.zipBookData(data, 0.5),
        this.exportZipWriter,
        0.5
      );
    }

    return 0;
  }

  async saveProgress(data: BooksDbBookmarkData | File) {
    const filename = `${this.sanitizedTitle}/${BaseStorageHandler.getProgressFileName(data)}`;

    if (data instanceof File) {
      this.exportZipWriter = await this.addDataToZip(filename, data, this.exportZipWriter);
    } else {
      this.exportZipWriter = await this.addDataToZip(
        filename,
        JSON.stringify(data),
        this.exportZipWriter
      );
    }
  }

  async saveCover(data: Blob | undefined) {
    if (!data) {
      BaseStorageHandler.reportProgress();
      return;
    }

    const filename = await BaseStorageHandler.getCoverFileName(data);
    this.exportZipWriter = await this.addDataToZip(
      `${this.sanitizedTitle}/${filename}`,
      data,
      this.exportZipWriter
    );
  }

  async createExportZip(document: Document, resetOnly: boolean) {
    if (!resetOnly && this.exportZipWriter) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await this.exportZipWriter.close());
      a.rel = 'noopener';
      a.download = `ttu-reader-export-${new Date()
        .toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        .replaceAll(/[/:, ]+/g, '-')}.zip`;

      setTimeout(() => {
        URL.revokeObjectURL(a.href);
      }, 1e4);

      setTimeout(() => {
        a.click();
        this.clearData();
      });
    } else if (resetOnly) {
      this.clearData();
    }
  }

  private findEntry(filePrefix: string, progressBase = 0.1) {
    const zipEntry = this.importEntries.find((entry) =>
      entry.filename.startsWith(`${this.sanitizedTitle}/${filePrefix}`)
    );

    BaseStorageHandler.reportProgress(progressBase);

    return { zipEntry, filename: zipEntry?.filename.replace(`${this.sanitizedTitle}/`, '') || '' };
  }
}
