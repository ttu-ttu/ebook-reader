/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Storage source backed by the self-hosted Calibre library. Not part of upstream.
 *
 * The book list is the Calibre catalog. Reader data (processed books, progress,
 * statistics, ...) is stored on the server through nginx WebDAV at /calibre/sync/,
 * using the same folder-per-title layout as the GDrive/OneDrive handlers.
 * A book is processed from its Calibre file the first time it is opened.
 *
 * While signed in to an account (lib/data/account.ts), the files that belong to a
 * reader rather than to the book (progress, statistics, reading goals and
 * highlights) live in the same layout under the account's /account/sync/ folder.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { accountReady, accountSyncUrl, currentAccount } from '$lib/data/account';
import {
  calibreCoverUrl,
  calibreVnUrl,
  downloadCalibreBook,
  loadCalibreCatalog,
  loadCalibreDifficulty,
  type CalibreBook
} from '$lib/data/calibre';
import { ApiStorageHandler, type RequestOptions } from '$lib/data/storage/handler/api-handler';
import { BaseStorageHandler, type ExternalFile } from '$lib/data/storage/handler/base-handler';
import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
import { StorageKey, StorageSourceDefault } from '$lib/data/storage/storage-types';
import { applySeriesOverride, loadSeriesOverrides } from '$lib/data/series-overrides';
import { applyMetadata, loadBookMetadata } from '$lib/data/book-metadata';
import { database } from '$lib/data/store';
import { storage } from '$lib/data/window/navigator/storage';
import loadEpub from '$lib/functions/file-loaders/epub/load-epub';
import loadHtmlz from '$lib/functions/file-loaders/htmlz/load-htmlz';
import loadTxt from '$lib/functions/file-loaders/txt/load-txt';
import loadCbz from '$lib/functions/file-loaders/cbz/load-cbz';
import { loadVnFolder } from '$lib/functions/file-loaders/vn/load-vn';
import { deleteOrphanVnCaches } from '$lib/data/vn';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';
import pLimit from 'p-limit';

interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory' | 'other';
}

const syncBaseUrl = '/calibre/sync/';

/** 401 from the sync folder: an expired session, or a signed-out reader outside the trusted networks. */
function unauthorizedError() {
  return Object.assign(
    new Error(
      currentAccount()
        ? 'Your sign-in has expired. Sign in again in Settings → General → Account.'
        : 'Using the library from this network needs an account. Sign in in Settings → General → Account.'
    ),
    { status: 401 }
  );
}

function filesIn(folderId: string, entries: DirectoryEntry[] = []): ExternalFile[] {
  return entries
    .filter((entry) => entry.type === 'file')
    .map((entry) => ({ id: `${folderId}${encodeURIComponent(entry.name)}`, name: entry.name }));
}

export class CalibreStorageHandler extends ApiStorageHandler {
  /**
   * URL of an extra per-reader file (e.g. annotations) in a book's sync folder.
   * Call after accountReady().
   */
  static syncFileUrl(title: string, fileName: string) {
    const { folderName } = CalibreStorageHandler;

    return `${currentAccount() ? accountSyncUrl : syncBaseUrl}${folderName(
      BaseStorageHandler.rootName
    )}/${folderName(title)}/${encodeURIComponent(fileName)}`;
  }

  /** URL path segment of a title's (or the root's) sync folder. */
  private static folderName(name: string) {
    return encodeURIComponent(BaseStorageHandler.sanitizeForFilename(name));
  }

  /** Files stored per account while signed in; everything else is shared. */
  private static isPersonalFile(name: string) {
    return (
      name.startsWith('progress_') ||
      name.startsWith('statistics_') ||
      name.startsWith(BaseStorageHandler.readingGoalsFilePrefix)
    );
  }

  /**
   * Whether personal files go to the account folder. Refreshed in ensureTitle,
   * which every storage operation calls first.
   */
  private useAccountFolder = false;

  private titleToCalibreBook = new Map<string, CalibreBook>();

  private nextCardId = Date.now();

  constructor(window: Window) {
    super(StorageKey.CALIBRE, window, '');
  }

  setInternalSettings() {
    this.storageSourceName = StorageSourceDefault.CALIBRE_DEFAULT;
  }

  async getBookList() {
    if (!this.dataListFetched) {
      database.listLoading$.next(true);

      try {
        const [books, , , difficulty, personalTitles] = await Promise.all([
          loadCalibreCatalog(true),
          loadSeriesOverrides(true).catch(() => ({})),
          loadBookMetadata(true).catch(() => ({})),
          loadCalibreDifficulty().catch(
            () => ({}) as Awaited<ReturnType<typeof loadCalibreDifficulty>>
          ),
          this.listRoot()
        ]);
        const listLimiter = pLimit(6);
        const catalogTitles = new Set(books.map((book) => book.title));
        // Account files of a book that is neither in the catalog nor in the shared folder
        // (deleted, or imported earlier under another title) are kept but not listed:
        // without book data or a cover the card couldn't be opened.
        const titles = new Set([
          ...this.titleToId.keys(),
          ...personalTitles.filter((title) => catalogTitles.has(title))
        ]);

        await Promise.all(
          [...titles].map((title) =>
            listLimiter(async () => {
              const titleId = this.titleToId.get(title) || this.sharedTitleId(title);

              this.setTitleFiles(title, await this.listTitleFiles(titleId));
            })
          )
        );

        for (let index = 0, { length } = books; index < length; index += 1) {
          const book = books[index];
          const bookCard = this.titleToBookCard.get(book.title) || this.createBookCard(book.title);

          this.titleToCalibreBook.set(book.title, book);
          this.titleToBookCard.set(book.title, {
            ...bookCard,
            // Unopened books sort by when they were added to Calibre.
            lastBookModified: bookCard.lastBookModified || book.added,
            imagePath: calibreCoverUrl(book) || bookCard.imagePath,
            // Unopened books: the difficulty service's count, so length filters see them.
            characters: bookCard.characters || difficulty[book.id]?.characters || 0,
            authors: book.authors,
            series: book.series,
            seriesIndex: book.seriesIndex,
            seriesInferred: book.seriesInferred,
            tags: book.tags,
            rating: book.rating,
            difficulty: difficulty[book.id]?.difficulty,
            difficultyLow: difficulty[book.id]?.low,
            difficultyHigh: difficulty[book.id]?.high,
            words95: difficulty[book.id]?.words95 ?? undefined,
            manga: (book.format === 'CBZ' || book.format === 'ZIP') && !book.vn,
            vn: !!book.vn,
            // Game folders (format VN) aren't in Calibre, but their catalog ids key estimates too.
            calibreId: book.id
          });
        }

        this.dataListFetched = true;
        // Only after the catalog loaded: a failed or signed-out load must not drop kept games.
        deleteOrphanVnCaches(catalogTitles).catch(() => {});
      } catch (error) {
        this.clearData();
        // Signed out where the library needs an account: an empty library that asks to
        // sign in (manage page), not a failure that switches the source to the browser.
        if (!currentAccount() && (error as { status?: number }).status === 401) {
          return [];
        }

        throw error;
      }
    }

    // Applied on every call, so a saved series shows without refetching the catalog.
    const [overrides, metadata] = await Promise.all([
      loadSeriesOverrides().catch(() => ({})),
      loadBookMetadata().catch(() => ({}))
    ]);

    return [...this.titleToBookCard.values()].map((card) =>
      applySeriesOverride(applyMetadata(card, metadata), overrides)
    );
  }

  async prepareBookForReading() {
    const localData = await database.getDataByTitle(this.currentContext.title);

    if (!localData?.elementHtml) {
      const { file } = await this.getExternalFile('bookdata_');

      if (!file) {
        await this.processCalibreBook();
      }
    }

    return super.prepareBookForReading();
  }

  /**
   * Books are cached in the browser, so they are only downloaded again when the
   * server copy is newer (e.g. re-processed on another device).
   */
  async getBook() {
    if (!this.isForBrowser) {
      return super.getBook();
    }

    const localData = await database.getDataByTitle(this.currentContext.title);
    const { file } = await this.getExternalFile('bookdata_');
    const remoteModified = file
      ? BaseStorageHandler.getBookMetadata(file.name).lastBookModified
      : 0;

    if (localData?.elementHtml && (localData.lastBookModified || 0) >= (remoteModified || 0)) {
      return undefined;
    }

    const book = await super.getBook();

    if (book && !(book instanceof File)) {
      await this.saveLocally(book);
    }

    return book;
  }

  protected async ensureTitle(name = BaseStorageHandler.rootName, _parent = '', readOnly = false) {
    this.useAccountFolder = !!(await accountReady());

    if (name === BaseStorageHandler.rootName) {
      if (!this.rootId) {
        const rootId = `${syncBaseUrl}${CalibreStorageHandler.folderName(name)}/`;

        if (!(await this.listDirectory(rootId))) {
          await this.davRequest(rootId, { method: 'MKCOL' }, [405]);
        }

        this.rootId = rootId;
      }

      return this.rootId;
    }

    const knownId = this.titleToId.get(name);

    if (knownId) {
      return knownId;
    }

    const titleId = this.sharedTitleId(name);
    const exists = !!(await this.listDirectory(titleId));

    if (!exists && readOnly) {
      return '';
    }

    if (!exists) {
      // 405: created in the meantime, e.g. by another device.
      await this.davRequest(titleId, { method: 'MKCOL' }, [405]);
    }

    this.titleToId.set(name, titleId);

    return titleId;
  }

  protected async getExternalFiles(remoteTitleId: string) {
    if (
      (!this.cacheStorageData || !this.dataListFetched) &&
      !this.titleToFiles.has(this.currentContext.title)
    ) {
      this.setTitleFiles(this.currentContext.title, await this.listTitleFiles(remoteTitleId));
    }

    return this.titleToFiles.get(this.currentContext.title) || [];
  }

  protected async setRootFiles() {
    if ((!this.cacheStorageData || !this.rootFileListFetched) && !this.rootFiles.size) {
      await this.listRoot();
    }
  }

  protected retrieve(
    file: ExternalFile,
    typeToRetrieve: XMLHttpRequestResponseType,
    progressBase = 1
  ) {
    return this.request(file.id, { trackDownload: true }, typeToRetrieve, progressBase);
  }

  protected async upload(
    folderId: string,
    name: string,
    files: ExternalFile[],
    externalFile: ExternalFile | undefined,
    data: Blob | string | undefined,
    rootFilePrefix?: string,
    progressBase = 0.8
  ): Promise<ExternalFile> {
    const id = this.fileId(folderId, name);

    // Metadata lives in the filename, so an update usually means a new name.
    if (data !== undefined) {
      await this.request(
        id,
        { method: 'PUT', body: data, trackUpload: true },
        'text',
        progressBase
      );

      if (externalFile && externalFile.id !== id) {
        await this.davRequest(externalFile.id, { method: 'DELETE' }, [404]);
      }
    } else if (externalFile && externalFile.id !== id) {
      await this.davRequest(externalFile.id, {
        method: 'MOVE',
        headers: {
          Destination: new URL(id, this.window.location.href).href,
          Overwrite: 'T'
        }
      });
    }

    if (externalFile) {
      externalFile.id = id;
    }

    this.updateAfterUpload(id, name, files, externalFile, {}, rootFilePrefix);

    return { id, name };
  }

  protected async executeDelete(id: string) {
    await this.davRequest(id, { method: 'DELETE' }, [404]);
  }

  protected request(
    url: string,
    options: RequestOptions = {},
    type: XMLHttpRequestResponseType = 'json',
    progressBase = 1
  ) {
    return super.request(url, { ...options, skipAuth: true }, type, progressBase);
  }

  private async processCalibreBook() {
    const { title } = this.currentContext;
    const calibreBook =
      this.titleToCalibreBook.get(title) ||
      (await loadCalibreCatalog()).find((book) => book.title === title);

    if (!calibreBook) {
      throw new Error(`${title} was not found in the Calibre library`);
    }

    const lastBookModified = Date.now();

    if (calibreBook.format === 'VN') {
      const game = await loadVnFolder(title, calibreVnUrl(calibreBook), lastBookModified);

      await this.saveBook(game, false);
      await this.saveLocally(game);
      return;
    }

    const file = await downloadCalibreBook(calibreBook);
    const { document } = this.window;

    let bookContent;

    switch (calibreBook.format) {
      case 'EPUB':
        bookContent = await loadEpub(file, document, lastBookModified);
        break;
      case 'TXT':
        bookContent = await loadTxt(file, lastBookModified);
        break;
      case 'CBZ':
      case 'ZIP':
        bookContent = await loadCbz(file, lastBookModified);
        break;
      default:
        bookContent = await loadHtmlz(file, document, lastBookModified);
        break;
    }

    // Keep the Calibre title rather than the one in the file, since titles identify books.
    bookContent.title = title;

    await this.saveBook(bookContent, false);
    await this.saveCover(bookContent.coverImage);
    await this.saveLocally(bookContent, bookContent.coverImage);
  }

  private async saveLocally(book: Omit<BooksDbBookData, 'id'>, cover?: Blob) {
    const browserHandler = getStorageHandler(
      this.window,
      StorageKey.BROWSER,
      undefined,
      true,
      this.cacheStorageData,
      ReplicationSaveBehavior.Overwrite
    );

    browserHandler.startContext({ title: book.title, imagePath: cover || '' });
    await browserHandler.saveBook({ ...book, storageSource: this.storageSourceName }, false, false);

    if (cover) {
      await browserHandler.saveCover(cover);
    }

    // Ask the browser not to evict cached books. Chrome decides silently; needs HTTPS.
    storage.persist().catch(() => {});
  }

  /** Lists the shared root, and the account root while signed in; returns titles found only there. */
  private async listRoot() {
    const rootId = await this.ensureTitle();
    const [entries, personalEntries] = await Promise.all([
      this.listDirectory(rootId).then((list) => list || []),
      this.useAccountFolder ? this.listDirectory(this.toPersonal(rootId)) : undefined
    ]);
    const personalTitles: string[] = [];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const entry = entries[index];

      if (entry.type === 'directory') {
        this.titleToId.set(
          BaseStorageHandler.desanitizeFilename(entry.name),
          `${rootId}${encodeURIComponent(entry.name)}/`
        );
      }
    }

    filesIn(rootId, entries)
      .filter((file) => !this.belongsInAccount(file.name))
      .forEach((file) => this.setRootFile(file.name, file));

    if (personalEntries) {
      personalEntries
        .filter((entry) => entry.type === 'directory')
        .forEach((entry) => personalTitles.push(BaseStorageHandler.desanitizeFilename(entry.name)));
      filesIn(this.toPersonal(rootId), personalEntries)
        .filter((file) => CalibreStorageHandler.isPersonalFile(file.name))
        .forEach((file) => this.setRootFile(file.name, file));
    }

    this.rootFileListFetched = true;

    return personalTitles;
  }

  /** Titles with a folder in the account's sync root; empty while signed out. */
  async listAccountTitles() {
    const rootId = await this.ensureTitle();

    if (!this.useAccountFolder) {
      return [];
    }

    const entries = (await this.listDirectory(this.toPersonal(rootId))) || [];

    return entries
      .filter((entry) => entry.type === 'directory')
      .map((entry) => BaseStorageHandler.desanitizeFilename(entry.name));
  }

  /** Files of a title: the shared folder, with personal files from the account while signed in. */
  private async listTitleFiles(titleId: string): Promise<ExternalFile[]> {
    if (!this.useAccountFolder) {
      return filesIn(titleId, await this.listDirectory(titleId));
    }

    const personalId = this.toPersonal(titleId);
    const [shared, personal] = await Promise.all([
      this.listDirectory(titleId),
      this.listDirectory(personalId)
    ]);

    return [
      ...filesIn(titleId, shared).filter(
        (file) => !CalibreStorageHandler.isPersonalFile(file.name)
      ),
      ...filesIn(personalId, personal).filter((file) =>
        CalibreStorageHandler.isPersonalFile(file.name)
      )
    ];
  }

  private sharedTitleId(title: string) {
    return `${this.rootId}${CalibreStorageHandler.folderName(title)}/`;
  }

  private belongsInAccount(name: string) {
    return this.useAccountFolder && CalibreStorageHandler.isPersonalFile(name);
  }

  /** Maps a shared /calibre/sync/ URL to the same path in the account folder. */
  private toPersonal(id: string) {
    return id.startsWith(syncBaseUrl) ? `${accountSyncUrl}${id.slice(syncBaseUrl.length)}` : id;
  }

  private fileId(folderId: string, name: string) {
    const id = `${folderId}${encodeURIComponent(name)}`;

    return this.belongsInAccount(name) ? this.toPersonal(id) : id;
  }

  private setTitleFiles(title: string, files: ExternalFile[]) {
    if (!files.length) {
      return;
    }

    const bookCard = { ...(this.titleToBookCard.get(title) || this.createBookCard(title)) };

    for (let index = 0, { length } = files; index < length; index += 1) {
      const file = files[index];

      if (file.name.startsWith('bookdata_')) {
        const { characters, lastBookModified, lastBookOpen } = BaseStorageHandler.getBookMetadata(
          file.name
        );

        bookCard.characters = characters;
        bookCard.lastBookModified = lastBookModified;
        bookCard.lastBookOpen = lastBookOpen;
      } else if (file.name.startsWith('progress_')) {
        const { progress, lastBookmarkModified } = BaseStorageHandler.getProgressMetadata(
          file.name
        );

        bookCard.progress = progress;
        bookCard.lastBookmarkModified = lastBookmarkModified;
      } else if (file.name.startsWith('cover_') && !bookCard.imagePath) {
        bookCard.imagePath = file.id;
      }
    }

    this.titleToFiles.set(title, files);
    this.titleToBookCard.set(title, bookCard);
  }

  private createBookCard(title: string): BookCardProps {
    const id = this.nextCardId;

    this.nextCardId += 1;

    return {
      id,
      title,
      imagePath: '',
      characters: 0,
      lastBookModified: 0,
      lastBookOpen: 0,
      progress: 0,
      lastBookmarkModified: 0,
      isPlaceholder: false
    };
  }

  /** JSON directory listing from nginx autoindex, or undefined if the directory is missing. */
  private async listDirectory(url: string): Promise<DirectoryEntry[] | undefined> {
    const response = await fetch(url, { cache: 'no-store' });

    if (response.status === 404) {
      return undefined;
    }

    if (response.status === 401) {
      throw unauthorizedError();
    }

    if (!response.ok) {
      throw new Error(`Calibre sync listing failed (HTTP ${response.status})`);
    }

    return response.json();
  }

  private async davRequest(url: string, init: RequestInit, allowedStatuses: number[] = []) {
    const response = await fetch(url, init);

    if (response.status === 401) {
      throw unauthorizedError();
    }

    if (!response.ok && !allowedStatuses.includes(response.status)) {
      throw new Error(`Calibre sync ${init.method} failed (HTTP ${response.status})`);
    }
  }
}
