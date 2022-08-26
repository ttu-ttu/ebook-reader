/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import type {
  BooksDbBookData,
  BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';
import { throwIfAborted } from '$lib/functions/replication/replication-error';
import {
  replicationProgress$,
  type ReplicationContext
} from '$lib/functions/replication/replication-progress';
import pLimit from 'p-limit';
import { Subject, Subscription, throttleTime } from 'rxjs';
import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipWriter,
  type Entry
} from '@zip.js/zip.js';

export abstract class BaseStorageHandler {
  abstract init(window: Window): void;

  abstract getDataList(): Promise<BookCardProps[]>;

  abstract applyUpsert(book: Omit<BooksDbBookData, 'id'>, id?: number): void;

  abstract saveBook(
    book: Omit<BooksDbBookData, 'id'> | File,
    title: string,
    cancelSignal?: AbortSignal
  ): Promise<number>;

  abstract saveProgress(
    context: ReplicationContext,
    progress: BooksDbBookmarkData | File
  ): Promise<void>;

  abstract deleteBookData(booksToDelete: string[], cancelSignal: AbortSignal): Promise<any[]>;

  abstract getBookData(
    context: ReplicationContext,
    isBrowserTarget?: boolean,
    cancelSignal?: AbortSignal
  ): Promise<Omit<BooksDbBookData, 'id'> | File | undefined>;

  abstract getProgressData(
    context: ReplicationContext,
    isBrowserTarget?: boolean
  ): Promise<BooksDbBookmarkData | File | undefined>;

  protected window: Window;

  protected dataListFetched = false;

  protected titleToFileData = new Map<string, BookCardProps>();

  protected reporter = new Subject<void>();

  private reportSub: Subscription | undefined;

  constructor(window: Window) {
    this.window = window;
  }

  scheduleReporter(isStart = true) {
    if (isStart && !this.reportSub) {
      this.reportSub = this.reporter.pipe(throttleTime(1000)).subscribe(() => {
        replicationProgress$.next({ reportOnly: true });
      });
    } else if (!isStart && this.reportSub) {
      this.reportSub.unsubscribe();
      this.reportSub = undefined;
    }
  }

  async zipBookData(bookdata: Omit<BooksDbBookData, 'id'>, cancelSignal?: AbortSignal) {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
    const blobsToZip = [];
    const blobEntries = [...Object.entries(bookdata.blobs)];
    const staticDataToZip: Array<keyof Omit<BooksDbBookData, 'id'>> = [
      'styleSheet',
      'elementHtml',
      'sections'
    ];
    const staticData: any = {};
    const limiter = pLimit(1);
    const cover = bookdata.coverImage;

    for (let index = 0, { length } = blobEntries; index < length; index += 1) {
      blobsToZip.push(
        limiter(() => {
          const [name, blob] = blobEntries[index];

          return this.addDataToZip(`blobs/${name}`, blob, zipWriter, cancelSignal).catch(
            (error) => {
              limiter.clearQueue();
              throw error;
            }
          );
        })
      );
    }

    await Promise.all(blobsToZip);

    if (cover instanceof Blob) {
      await this.addDataToZip(
        `cover.${cover.type.replace('image/', '')}`,
        cover,
        zipWriter,
        cancelSignal
      );
    }

    this.reporter.next();

    for (let index = 0, { length } = staticDataToZip; index < length; index += 1) {
      throwIfAborted(cancelSignal);

      const dataProperty = staticDataToZip[index];

      if (Object.prototype.hasOwnProperty.call(bookdata, dataProperty)) {
        staticData[dataProperty] = bookdata[dataProperty];
      }

      this.reporter.next();
    }

    if (Object.keys(staticData).length) {
      await this.addDataToZip(
        'staticdata.json',
        JSON.stringify(staticData),
        zipWriter,
        cancelSignal
      );
    }

    this.reporter.next();

    const finalZip = await zipWriter.close();

    return finalZip;
  }

  async addDataToZip(
    name: string,
    data: string | Blob,
    writer?: ZipWriter<Blob>,
    cancelSignal?: AbortSignal
  ) {
    throwIfAborted(cancelSignal);

    const zipWriter = writer || new ZipWriter(new BlobWriter('application/zip'));

    if (data instanceof Blob) {
      await zipWriter.add(name, new BlobReader(data));
    } else if (data) {
      await zipWriter.add(name, new TextReader(data));
    }

    this.reporter.next();

    return zipWriter;
  }

  async readFromZip(writer: BlobWriter | TextWriter, errorForNoRead: string, retrievedData: Entry) {
    const zipData =
      writer instanceof BlobWriter
        ? await retrievedData.getData?.(writer)
        : await retrievedData.getData?.(writer);

    this.reporter.next();

    if (!zipData) {
      throw new Error(errorForNoRead);
    }

    return zipData;
  }

  async extractBookData(
    bookDataEntries: Entry[],
    title: string,
    fileName: string,
    cancelSignal?: AbortSignal
  ) {
    if (!bookDataEntries.length) {
      return undefined;
    }

    const bookObject: Omit<BooksDbBookData, 'id'> = {
      title,
      styleSheet: '',
      elementHtml: '',
      hasThumb: true,
      blobs: {} as Record<string, Blob>,
      coverImage: '',
      sections: [],
      lastBookModified: 0,
      lastBookOpen: 0
    };

    const bookObjectTransforms = [];
    const fileData = fileName.split('_').map((file) => file.replace(/\.zip$/, ''));
    const limiter = pLimit(1);

    for (let index = 0, { length } = bookDataEntries; index < length; index += 1) {
      bookObjectTransforms.push(
        limiter(async () => {
          try {
            throwIfAborted(cancelSignal);

            const entry = bookDataEntries[index];

            if (entry.filename === 'staticdata.json') {
              const staticData = JSON.parse(
                (await this.readFromZip(
                  new TextWriter(),
                  'Unable to read Static Data',
                  entry
                )) as string
              ) as BooksDbBookData;

              if (!staticData.elementHtml) {
                throw new Error(`Invalid Bookdata - empty element HTML`);
              }

              bookObject.elementHtml = staticData.elementHtml;
              bookObject.styleSheet = staticData.styleSheet || '';
              bookObject.sections = staticData.sections || [];
              bookObject.lastBookModified = fileData[3] ? +fileData[3] : 0;
              bookObject.lastBookOpen = fileData[4] ? +fileData[4] : 0;
            } else if (entry.filename.startsWith('blobs/')) {
              const imagePath = entry.filename.replace('blobs/', '');
              const existingBlobEntries = bookObject.blobs || {};

              existingBlobEntries[imagePath] = (await this.readFromZip(
                new BlobWriter(),
                'Unable to read Blob Data',
                entry
              )) as Blob;
              bookObject.blobs = existingBlobEntries;
            } else if (entry.filename.startsWith('cover')) {
              bookObject.coverImage = (await this.readFromZip(
                new BlobWriter(),
                'Unable to read Cover',
                entry
              )) as Blob;
            }

            this.reporter.next();
          } catch (error) {
            limiter.clearQueue();
            throw error;
          }
        })
      );
    }

    await Promise.all(bookObjectTransforms);

    return bookObject;
  }

  async extractProgress(entry: Entry) {
    if (!entry) {
      return undefined;
    }

    const progressData = JSON.parse(
      (await this.readFromZip(new TextWriter(), 'Unable to read Progress Data', entry)) as string
    ) as BooksDbBookmarkData;

    return progressData;
  }
}
