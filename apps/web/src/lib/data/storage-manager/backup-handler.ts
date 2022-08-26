/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import {
  currentDbVersion,
  type BooksDbBookData,
  type BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';
import { BaseStorageHandler } from '$lib/data/storage-manager/base-handler';
import type { ReplicationContext } from '$lib/functions/replication/replication-progress';
import { exporterVersion } from '$lib/functions/replication/replicator';
import { BlobReader, BlobWriter, ZipReader, type Entry, type ZipWriter } from '@zip.js/zip.js';

export class BackupStorageHandler extends BaseStorageHandler {
  private exportZipWriter: ZipWriter<Blob> | undefined;

  private importReader: ZipReader<Blob> | undefined;

  private importEntries: Entry[] = [];

  async init(window: Window) {
    this.window = window;
  }

  /* eslint-disable class-methods-use-this */
  async getDataList(): Promise<BookCardProps[]> {
    return [];
  }

  applyUpsert(): void {
    // no-op
  }

  async deleteBookData() {
    return ['', 0];
  }
  /* eslint-enable class-methods-use-this */

  async setBackupZip(data: Blob) {
    this.importReader = new ZipReader(new BlobReader(data));

    this.reporter.next();

    this.importEntries = await this.importReader.getEntries();

    return this.importEntries.map((entry) => ({ id: 0, title: entry.filename.split('/')[0] }));
  }

  async saveBook(
    bookData: Omit<BooksDbBookData, 'id'> | File,
    title: string,
    cancelSignal?: AbortSignal
  ) {
    if (bookData instanceof File) {
      this.exportZipWriter = await this.addDataToZip(
        `${title}/${bookData.name}`,
        bookData,
        this.exportZipWriter,
        cancelSignal
      );
    } else {
      this.exportZipWriter = await this.addDataToZip(
        `${bookData.title}/bookdata_${exporterVersion}_${currentDbVersion}_${
          bookData.lastBookModified || 0
        }_${bookData.lastBookOpen || 0}.zip`,
        await this.zipBookData(bookData, cancelSignal),
        this.exportZipWriter,
        cancelSignal
      );
    }
    return 0;
  }

  async saveProgress(context: ReplicationContext, progress: BooksDbBookmarkData | File) {
    if (progress instanceof File) {
      this.exportZipWriter = await this.addDataToZip(
        `${context.title}/${progress.name}`,
        progress,
        this.exportZipWriter
      );
    } else {
      this.exportZipWriter = await this.addDataToZip(
        `${context.title}/progress_${exporterVersion}_${currentDbVersion}_${
          progress.lastBookmarkModified || 0
        }_${progress.progress}.json`,
        JSON.stringify(progress),
        this.exportZipWriter
      );
    }
  }

  async getBookData(
    context: ReplicationContext,
    isBrowserTarget: boolean,
    cancelSignal?: AbortSignal
  ) {
    const zipEntry = this.importEntries.find((entry) =>
      entry.filename.startsWith(`${context.title}/bookdata`)
    );

    if (!zipEntry) {
      return undefined;
    }

    const fileName = zipEntry.filename.replace(`${context.title}/`, '');
    const bookBlob = (await this.readFromZip(
      new BlobWriter(),
      'Unable to read Bookdata',
      zipEntry
    )) as Blob;

    if (isBrowserTarget) {
      const bookreader = new ZipReader(new BlobReader(bookBlob));
      const bookEntries = await bookreader.getEntries();

      return this.extractBookData(bookEntries, context.title, fileName, cancelSignal);
    }

    return new File([bookBlob], fileName, { type: 'application/zip' });
  }

  async getProgressData(context: ReplicationContext, isBrowserTarget: boolean) {
    const zipEntry = this.importEntries.find((entry) =>
      entry.filename.startsWith(`${context.title}/progress`)
    );

    if (!zipEntry) {
      return undefined;
    }

    if (isBrowserTarget) {
      return this.extractProgress(zipEntry);
    }

    const progressBlob = (await this.readFromZip(
      new BlobWriter(),
      'Unable to read Progressdata',
      zipEntry
    )) as Blob;

    return new File([progressBlob], zipEntry.filename.replace(`${context.title}/`, ''), {
      type: 'application/json'
    });
  }

  async createExportZip(document: Document, resetOnly: boolean) {
    if (!resetOnly && this.exportZipWriter) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await this.exportZipWriter.close());
      a.rel = 'noopener';
      a.download = `ttu-reader-export-${new Date().getTime()}.zip`;

      setTimeout(() => {
        URL.revokeObjectURL(a.href);
      }, 1e4);

      setTimeout(() => {
        a.click();
        this.exportZipWriter = undefined;
        this.importReader = undefined;
        this.importEntries = [];
      });
    } else if (resetOnly) {
      this.exportZipWriter = undefined;
      this.importReader = undefined;
      this.importEntries = [];
    }
  }
}
