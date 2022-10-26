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
import type { Section } from '$lib/data/database/books-db/versions/v4/books-db-v4';
import { internalStorageSourceName, type StorageKey } from '$lib/data/storage/storage-types';
import { exporterVersion } from '$lib/functions/replication/replicator';
import { throwIfAborted } from '$lib/functions/replication/replication-error';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import {
  replicationProgress$,
  type ReplicationContext,
  type ReplicationDeleteResult
} from '$lib/functions/replication/replication-progress';
import pLimit from 'p-limit';
import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter,
  type Entry
} from '@zip.js/zip.js';

export interface ExternalFile {
  id: string;
  name: string;
}

export abstract class BaseStorageHandler {
  abstract updateSettings(
    window: Window,
    isForBrowser: boolean,
    saveBehavior: string,
    cacheStorageData: boolean,
    askForStorageUnlock: boolean,
    storageSourceName: string
  ): void;

  abstract getBookList(): Promise<BookCardProps[]>;

  abstract clearData(clearAll?: boolean): void;

  abstract prepareBookForReading(): Promise<number>;

  abstract updateLastRead(book: BooksDbBookData): Promise<void>;

  abstract getFilenameForRecentCheck(fileIdentifier: string): Promise<string | undefined>;

  abstract isBookPresentAndUpToDate(referenceFilename: string | undefined): Promise<boolean>;

  abstract isProgressPresentAndUpToDate(referenceFilename: string | undefined): Promise<boolean>;

  abstract getBook(): Promise<Omit<BooksDbBookData, 'id'> | File | undefined>;

  abstract getProgress(): Promise<BooksDbBookmarkData | File | undefined>;

  abstract getCover(): Promise<Blob | undefined>;

  abstract saveBook(
    data: Omit<BooksDbBookData, 'id'> | File,
    skipTimestampFallback?: boolean,
    removeStorageContext?: boolean
  ): Promise<number>;

  abstract saveProgress(data: BooksDbBookmarkData | File): Promise<void>;

  abstract saveCover(data: Blob | undefined): Promise<void>;

  abstract deleteBookData(
    booksToDelete: string[],
    cancelSignal: AbortSignal
  ): Promise<ReplicationDeleteResult>;

  static rootName = 'ttu-reader-data';

  storageType: StorageKey;

  protected window: Window;

  protected storageSourceName = internalStorageSourceName;

  protected isForBrowser = false;

  protected cacheStorageData = false;

  protected saveBehavior = ReplicationSaveBehavior.NewOnly;

  protected askForStorageUnlock = true;

  protected currentContext: ReplicationContext = { title: '' };

  protected cancelSignal: AbortSignal | undefined;

  protected currentLastProgressValue = 0;

  protected currentProgressBase = 0;

  protected sanitizedTitle = '';

  protected dataListFetched = false;

  protected titleToBookCard = new Map<string, BookCardProps>();

  constructor(window: Window, storageType: StorageKey) {
    this.window = window;
    this.storageType = storageType;
  }

  static getBookCharacters(characterAmount: number, sections: Section[]) {
    if (characterAmount) {
      return characterAmount;
    }

    const lastSection = sections
      .reverse()
      .find((section) => section.startCharacter !== undefined && section.characters !== undefined);

    let characters = 0;

    if (lastSection?.startCharacter && lastSection.characters) {
      characters = lastSection.startCharacter + lastSection.characters;
    }

    return characters;
  }

  static reportProgress(progressToAdd = 1) {
    replicationProgress$.next({ progressToAdd });
  }

  static completeStep() {
    replicationProgress$.next({ completeStep: true });
  }

  isCacheDisabled() {
    return !this.cacheStorageData;
  }

  getCurrentStorageSource() {
    return this.storageSourceName;
  }

  startContext(context: ReplicationContext, cancelSignal?: AbortSignal) {
    this.currentContext = context;
    this.cancelSignal = cancelSignal;
    this.currentLastProgressValue = 0;
    this.currentProgressBase = 0;
    this.sanitizedTitle = BaseStorageHandler.sanitizeForFilename(this.currentContext.title);
  }

  protected addBookCard(title: string, dataToAdd: Record<string, any>) {
    const bookCard: BookCardProps = {
      ...(this.titleToBookCard.get(title) || {
        id: BaseStorageHandler.getDummyId(),
        title,
        imagePath: '',
        characters: 0,
        lastBookModified: 0,
        lastBookOpen: 0,
        progress: 0,
        lastBookmarkModified: 0,
        isPlaceholder: false
      }),
      ...dataToAdd
    };

    this.titleToBookCard.set(title, bookCard);
  }

  protected async zipBookData(bookdata: Omit<BooksDbBookData, 'id'>, progressBase = 1) {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
    const blobsToZip = [];
    const blobEntries = [...Object.entries(bookdata.blobs)];
    const staticDataToZip: Array<
      Exclude<
        keyof Omit<BooksDbBookData, 'id'>,
        | 'blobs'
        | 'hasThumb'
        | 'coverImage'
        | 'characters'
        | 'lastBookModified'
        | 'lastBookOpen'
        | 'storageSource'
      >
    > = ['title', 'styleSheet', 'elementHtml', 'sections'];
    const staticData: Record<string, string | Section[] | undefined> = {};
    const limiter = pLimit(1);
    const cover = bookdata.coverImage;
    const isBlobCover = cover instanceof Blob;
    const filesInScope = blobEntries.length + staticDataToZip.length + (isBlobCover ? 1 : 0);
    const progressPerStep = progressBase / filesInScope;

    for (let index = 0, { length } = blobEntries; index < length; index += 1) {
      blobsToZip.push(
        limiter(async () => {
          const [name, blob] = blobEntries[index];

          await this.addDataToZip(`blobs/${name}`, blob, zipWriter, progressPerStep).catch(
            (error) => {
              limiter.clearQueue();
              throw error;
            }
          );
        })
      );
    }

    await Promise.all(blobsToZip);

    if (isBlobCover) {
      await this.addDataToZip(
        `cover.${await BaseStorageHandler.determineImageExtension(cover)}`,
        cover,
        zipWriter,
        progressPerStep
      );
    }

    for (let index = 0, { length } = staticDataToZip; index < length; index += 1) {
      throwIfAborted(this.cancelSignal);

      const dataProperty = staticDataToZip[index];

      staticData[dataProperty] = bookdata[dataProperty];
    }

    if (Object.keys(staticData).length) {
      await this.addDataToZip(
        'staticdata.json',
        JSON.stringify(staticData),
        zipWriter,
        progressPerStep
      );
    }

    const finalZip = await zipWriter.close();

    return finalZip;
  }

  protected async addDataToZip(
    name: string,
    data: string | Blob,
    writer: ZipWriter<Blob> | undefined,
    progressBase = 1
  ) {
    throwIfAborted(this.cancelSignal);

    const zipWriter = writer || new ZipWriter(new BlobWriter('application/zip'));

    this.currentLastProgressValue = 0;
    this.currentProgressBase = progressBase;

    if (data instanceof Blob) {
      await zipWriter.add(name, new BlobReader(data), {
        onprogress: (...args) => this.reportFunction(...args)
      });
    } else if (data) {
      await zipWriter.add(name, new TextReader(data), {
        onprogress: (...args) => this.reportFunction(...args)
      });
    }

    return zipWriter;
  }

  protected reportFunction(progress: number, total: number) {
    if (this.currentProgressBase) {
      const newProgress = progress / total;
      const progressDelta = newProgress - this.currentLastProgressValue;

      this.currentLastProgressValue = newProgress;

      BaseStorageHandler.reportProgress(progressDelta * this.currentProgressBase);
    }
  }

  protected async readFromZip(
    writer: BlobWriter,
    errorForNoRead: string,
    retrievedData: Entry,
    progressBase: number
  ): Promise<Blob>;
  protected async readFromZip(
    writer: TextWriter,
    errorForNoRead: string,
    retrievedData: Entry,
    progressBase: number
  ): Promise<string>;
  protected async readFromZip(
    writer: BlobWriter | TextWriter,
    errorForNoRead: string,
    retrievedData: Entry,
    progressBase = 1
  ) {
    this.currentLastProgressValue = 0;
    this.currentProgressBase = progressBase;

    const zipData =
      writer instanceof BlobWriter
        ? await retrievedData.getData?.(writer, {
            onprogress: (...args) => this.reportFunction(...args)
          })
        : await retrievedData.getData?.(writer, {
            onprogress: (...args) => this.reportFunction(...args)
          });

    if (!zipData) {
      throw new Error(errorForNoRead);
    }

    return zipData;
  }

  protected async extractBookData(book: Blob, filename: string, progressBase = 1) {
    const bookreader = new ZipReader(new BlobReader(book));
    const bookDataEntries = await bookreader.getEntries();

    if (!bookDataEntries.length) {
      BaseStorageHandler.reportProgress(progressBase);

      return undefined;
    }

    const bookObject: Omit<BooksDbBookData, 'id'> = {
      title: '',
      styleSheet: '',
      elementHtml: '',
      blobs: {} as Record<string, Blob>,
      coverImage: '',
      hasThumb: true,
      characters: 0,
      sections: [],
      lastBookModified: 0,
      lastBookOpen: 0
    };

    const bookObjectTransforms = [];
    const limiter = pLimit(1);
    const progressPerStep = progressBase / bookDataEntries.length;

    for (let index = 0, { length } = bookDataEntries; index < length; index += 1) {
      bookObjectTransforms.push(
        limiter(async () => {
          try {
            throwIfAborted(this.cancelSignal);

            const entry = bookDataEntries[index];

            if (entry.filename === 'staticdata.json') {
              const staticData = JSON.parse(
                await this.readFromZip(
                  new TextWriter(),
                  'Unable to read Static Data',
                  entry,
                  progressPerStep
                )
              ) as Omit<
                BooksDbBookData,
                | 'id'
                | 'blobs'
                | 'hasThumb'
                | 'coverImage'
                | 'lastBookModified'
                | 'lastBookOpen'
                | 'storageSource'
              >;

              if (!staticData.elementHtml) {
                throw new Error(`Invalid bookdata - empty element html`);
              }

              const { characters, lastBookModified, lastBookOpen } =
                BaseStorageHandler.getBookMetadata(filename);

              bookObject.title = staticData.title;
              bookObject.elementHtml = staticData.elementHtml;
              bookObject.styleSheet = staticData.styleSheet || '';
              bookObject.sections = staticData.sections || [];
              bookObject.characters = BaseStorageHandler.getBookCharacters(
                characters || 0,
                bookObject.sections
              );
              bookObject.lastBookModified = lastBookModified;
              bookObject.lastBookOpen = lastBookOpen;
            } else if (entry.filename.startsWith('blobs/')) {
              const imagePath = entry.filename.replace('blobs/', '');
              const existingBlobEntries = bookObject.blobs || {};

              existingBlobEntries[imagePath] = await this.readFromZip(
                new BlobWriter(),
                'Unable to read blob data',
                entry,
                progressPerStep
              );
              bookObject.blobs = existingBlobEntries;
            } else if (entry.filename.startsWith('cover.')) {
              bookObject.coverImage = await this.readFromZip(
                new BlobWriter(),
                'Unable to read cover data',
                entry,
                progressPerStep
              );
            }
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

  protected async extractProgress(entry: Entry, progressBase = 0.9) {
    if (!entry) {
      return undefined;
    }

    const progressData = JSON.parse(
      await this.readFromZip(new TextWriter(), 'Unable to read progress data', entry, progressBase)
    );

    return progressData;
  }

  protected static getDummyId() {
    return Math.floor(Date.now() * Math.random());
  }

  protected static sanitizeForFilename(title: string) {
    return title
      .replace(/[ ]$/, '~ttu-spc~')
      .replace(/[.]$/, '~ttu-dend~')
      .replace(/\*/g, '~ttu-star~')
      .replace(/[/?<>\\:*|%"]/g, (match) => encodeURIComponent(match));
  }

  protected static desanitizeFilename(title: string) {
    return decodeURIComponent(title)
      .replaceAll('~ttu-star~', '*')
      .replaceAll('~ttu-dend~', '.')
      .replaceAll('~ttu-spc~', ' ');
  }

  protected static getBookFileName(
    book: Omit<BooksDbBookData, 'id'> | File,
    existingFilename?: string
  ) {
    if (book instanceof File) {
      return book.name;
    }

    if (existingFilename) {
      const { characters, lastBookModified, lastBookOpen } =
        BaseStorageHandler.getBookMetadata(existingFilename);

      return `bookdata_${exporterVersion}_${currentDbVersion}_${
        characters ||
        BaseStorageHandler.getBookCharacters(book.characters || 0, book.sections || [])
      }_${book.lastBookModified || lastBookModified || 0}_${
        book.lastBookOpen || lastBookOpen || 0
      }.zip`;
    }

    return `bookdata_${exporterVersion}_${currentDbVersion}_${BaseStorageHandler.getBookCharacters(
      book.characters || 0,
      book.sections || []
    )}_${book.lastBookModified || 0}_${book.lastBookOpen || 0}.zip`;
  }

  protected static getProgressFileName(progress: BooksDbBookmarkData | File) {
    return progress instanceof File
      ? progress.name
      : `progress_${exporterVersion}_${currentDbVersion}_${progress.lastBookmarkModified || 0}_${
          progress.progress || 0
        }.json`;
  }

  protected static async getCoverFileName(cover: Blob) {
    const type = (await BaseStorageHandler.determineImageExtension(cover)) || 'jpeg';

    return `cover_${exporterVersion}_${currentDbVersion}.${type}`;
  }

  protected static getBookMetadata(filename: string) {
    const parts = filename.split('_').map((part) => part.replace(/\.zip$/, ''));

    return {
      exporterVersion: +parts[1],
      dbVersion: +parts[2],
      characters: +parts[3],
      lastBookModified: +parts[4],
      lastBookOpen: +parts[5]
    };
  }

  protected static getProgressMetadata(filename: string) {
    const parts = filename.split('_').map((part) => part.replace(/\.json$/, ''));

    return {
      exporterVersion: +parts[1],
      dbVersion: +parts[2],
      lastBookmarkModified: +parts[3],
      progress: +parts[4]
    };
  }

  private static async determineImageExtension(cover: Blob) {
    if (cover.type) {
      return cover.type.replace('image/', '') || 'jpeg';
    }

    let buffer: Uint8Array;

    try {
      if (typeof cover.arrayBuffer === 'function') {
        buffer = new Uint8Array(await cover.arrayBuffer());
      } else {
        buffer = await this.readBufferForBlob(cover);
      }

      const magicBytes = buffer.slice(0, 4);

      let hexSignature = '';

      for (let index = 0, { length } = magicBytes; index < length; index += 1) {
        hexSignature += magicBytes[index].toString(16);
      }

      switch (true) {
        case /^89504e47/.test(hexSignature):
          return 'png';
        case /^47494638/.test(hexSignature):
          return 'gif';
        case /^424d/.test(hexSignature):
          return 'bmp';
        case /^52494646/.test(hexSignature):
          return 'webp';
        default:
          return 'jpeg';
      }
    } catch (error) {
      return 'jpeg';
    }
  }

  private static readBufferForBlob(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener('load', () => {
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      });

      reader.addEventListener('error', () => {
        reject(new Error(`Error reading Blob`));
      });

      reader.readAsArrayBuffer(blob);
    });
  }
}
