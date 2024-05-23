/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
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
import type { MergeMode } from '$lib/data/merge-mode';
import { readingGoalSortFunction } from '$lib/data/reading-goal';
import { BaseStorageHandler, FilePrefix } from '$lib/data/storage/handler/base-handler';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
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

  isBookPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  isProgressPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  areStatisticsPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  areReadingGoalsPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  isAudioBookPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  isSubtitleDataPresentAndUpToDate() {
    BaseStorageHandler.reportProgress();
    return Promise.resolve(false);
  }

  deleteBookData() {
    return Promise.resolve({ error: '', deleted: [] });
  }
  /* eslint-enable class-methods-use-this */

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
      const nameParts = entry.filename.split('/');
      const sanitizedTitle = nameParts[0];
      const title = BaseStorageHandler.desanitizeFilename(sanitizedTitle);

      if (nameParts.length === 1) {
        this.setRootFile(title, { id: title, name: title });
      } else if (nameParts.length > 1) {
        const context = titles.get(title) || { title, imagePath: '' };

        if (entry.filename.startsWith(`${sanitizedTitle}/cover_`)) {
          context.imagePath = entry;
        }

        titles.set(title, context);
      }
    }

    return [...titles.values()];
  }

  async getFilenameForRecentCheck(fileIdentifier: string) {
    if (this.saveBehavior === ReplicationSaveBehavior.Overwrite) {
      BaseStorageHandler.reportProgress();
      return undefined;
    }

    const { filename } = this.validRootFiles.includes(fileIdentifier)
      ? this.getRootFile(fileIdentifier)
      : this.findEntry(fileIdentifier);

    BaseStorageHandler.completeStep();

    return filename;
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

    if (this.isForBrowser) {
      return this.extractAsJSON(zipEntry, 'Unable to read progress data');
    }

    const progressBlob = await this.readFromZip(
      new BlobWriter(),
      'Unable to read progress data',
      zipEntry,
      0.9
    );

    return new File([progressBlob], filename, { type: 'application/json' });
  }

  async getStatistics() {
    const { zipEntry, filename } = this.findEntry('statistics_');

    if (!zipEntry) {
      return { statistics: undefined, lastStatisticModified: 0 };
    }

    const statistics = await this.extractAsJSON(zipEntry, 'Unable to read statistics');

    return {
      statistics,
      lastStatisticModified:
        BaseStorageHandler.getStatisticsMetadata(filename).lastStatisticModified
    };
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

  async getReadingGoals() {
    const { zipEntry, filename } = this.getRootFile(BaseStorageHandler.readingGoalsFilePrefix);

    if (!zipEntry) {
      return { readingGoals: undefined, lastGoalModified: 0 };
    }

    const readingGoals = await this.extractAsJSON(zipEntry, 'Unable to read reading goals');

    return {
      readingGoals,
      lastGoalModified: BaseStorageHandler.getReadingGoalsMetadata(filename).lastGoalModified
    };
  }

  async getAudioBook() {
    const { zipEntry, filename } = this.findEntry(FilePrefix.AUDIO_BOOK);

    if (!zipEntry) {
      return undefined;
    }

    if (this.isForBrowser) {
      return this.extractAsJSON(zipEntry, 'Unable to read audioBook data');
    }

    const audioBookBlob = await this.readFromZip(
      new BlobWriter(),
      'Unable to read audioBook data',
      zipEntry,
      0.9
    );

    return new File([audioBookBlob], filename, { type: 'application/json' });
  }

  async getSubtitleData() {
    const { zipEntry, filename } = this.findEntry(FilePrefix.SUBTITLE);

    if (!zipEntry) {
      return undefined;
    }

    if (this.isForBrowser) {
      return this.extractAsJSON(zipEntry, 'Unable to read subtitles data');
    }

    const subtitleDataBlob = await this.readFromZip(
      new BlobWriter(),
      'Unable to read subtitles data',
      zipEntry,
      0.9
    );

    return new File([subtitleDataBlob], filename, { type: 'application/json' });
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

  async saveStatistics(data: BooksDbStatistic[], lastStatisticModified: number) {
    const filename = `${this.sanitizedTitle}/${BaseStorageHandler.getStatisticsFileName(
      data,
      lastStatisticModified
    )}`;

    data.sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));

    this.exportZipWriter = await this.addDataToZip(
      filename,
      JSON.stringify(data),
      this.exportZipWriter
    );
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

  async saveReadingGoals(data: BooksDbReadingGoal[], lastGoalModified: number) {
    const filename = `${BaseStorageHandler.getReadingGoalsFileName(lastGoalModified)}`;

    data.sort(readingGoalSortFunction);

    this.exportZipWriter = await this.addDataToZip(
      filename,
      JSON.stringify(data),
      this.exportZipWriter
    );
  }

  async saveAudioBook(data: BooksDbAudioBook | File) {
    const filename = `${this.sanitizedTitle}/${BaseStorageHandler.getAudioBookFileName(data)}`;

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

  async saveSubtitleData(data: BooksDbSubtitleData | File) {
    const filename = `${this.sanitizedTitle}/${BaseStorageHandler.getSubtitleDataFileName(data)}`;

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

  private getRootFile(filePrefix: string, progressBase = 0.1) {
    const rootFile = this.rootFiles.get(filePrefix);
    const zipEntry = rootFile
      ? this.importEntries.find((entry) => entry.filename === rootFile.name)
      : undefined;

    BaseStorageHandler.reportProgress(progressBase);

    return { zipEntry, filename: zipEntry?.filename || '' };
  }
}
