/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BaseStorageHandler, type ExternalFile } from './base-handler';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { ApiStorageHandler } from './api-handler';
import { database } from '$lib/data/store';
import type { StorageKey } from '../storage-types';
import { StorageBasicAuthManager } from '../storage-basic-auth-manager';

interface TsuFile {
  id: string;
  parent: string;
  name: string;
  card: BookCardProps;
}

export class RemoteApiStorageHandler extends ApiStorageHandler {
  private serverRoot = 'http://localhost:8080';

  constructor(storageType: StorageKey, window: Window) {
    super(storageType, window, new StorageBasicAuthManager());
  }

  // Generic JSON POST method
  private async callJson<T>(path: string, data?: any, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${this.serverRoot}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined,
      signal
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    return response.json() as Promise<T>;
  }

  protected setInternalSettings(storageSourceName: string): void {
    this.storageSourceName = storageSourceName;
  }
  protected async ensureTitle(
    name = BaseStorageHandler.rootName,
    parent = 'root',
    readOnly = false
  ): Promise<string> {
    if (name === BaseStorageHandler.rootName && this.rootId) {
      return this.rootId;
    }

    const externalId = this.titleToId.get(name);

    if (externalId) {
      return externalId;
    }

    const titleId = await this.callJson<{ id: string }>('ensureTitle', {
      name: name,
      parent: parent,
      readOnly: readOnly
    });

    if (titleId) {
      this.titleToId.set(name, titleId.id);
    }

    if (titleId && name === BaseStorageHandler.rootName) {
      this.rootId = titleId.id;
    }

    if (!titleId && name === BaseStorageHandler.rootName) {
      throw new Error('Root folder not found');
    }

    return titleId.id;
  }

  protected async getExternalFiles(remoteTitleId: string): Promise<ExternalFile[]> {
    if (
      (!this.cacheStorageData || !this.dataListFetched) &&
      !this.titleToFiles.has(this.currentContext.title)
    ) {
      const externalFiles = await this.list(remoteTitleId);
      if (externalFiles.length) {
        this.setTitleData(this.currentContext.title, externalFiles);
      }
    }

    return this.titleToFiles.get(this.currentContext.title) || [];
  }
  protected async setRootFiles(): Promise<void> {
    if ((!this.cacheStorageData || !this.rootFileListFetched) && !this.rootFiles.size) {
      const rootFiles = await this.list(this.rootId);

      for (const rootFile of rootFiles) {
        this.setRootFile(rootFile.name, rootFile);
      }

      this.rootFileListFetched = true;
    }
  }
  protected retrieve(
    file: TsuFile,
    typeToRetrieve: XMLHttpRequestResponseType,
    progressBase?: number
  ): Promise<any> {
    return this.request(
      `${this.serverRoot}/readFileData`,
      {
        trackDownload: true,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file: file.id
        })
      },
      typeToRetrieve,
      progressBase
    );
  }
  protected async upload(
    folderId: string,
    name: string,
    files: ExternalFile[],
    externalFile: ExternalFile | undefined,
    data: Blob | string | undefined,
    rootFilePrefix?: string,
    progressBase?: number
  ): Promise<ExternalFile> {
    const response = await this.request(
      `${this.serverRoot}/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent: folderId,
          name: name,
          data: data
        }),
        trackUpload: true
      },
      'json',
      progressBase
    );

    this.updateAfterUpload(
      response.id,
      response.name,
      files,
      externalFile,
      {
        parents: [folderId]
      },
      rootFilePrefix
    );

    return response;
  }
  protected async executeDelete(id: string): Promise<void> {
    this.callJson<void>('executeDelete', {
      id: id
    });
  }
  async getBookList(): Promise<BookCardProps[]> {
    if (!this.dataListFetched) {
      database.listLoading$.next(true);

      try {
        const files = await this.list(this.rootId);

        for (const file of files) {
          this.titleToBookCard.set(file.card.title, file.card);
        }

        this.dataListFetched = true;
      } catch (error) {
        this.clearData();
        throw error;
      }
    }

    return [...this.titleToBookCard.values()];
  }

  private async list(folderId: string) {
    return this.callJson<TsuFile[]>('listFiles', {
      parent: folderId
    });
  }

  private async setTitleData(title: string, files: ExternalFile[]) {
    if (!files.length) {
      return;
    }

    const bookCard: BookCardProps = {
      id: BaseStorageHandler.getDummyId(),
      title,
      imagePath: '',
      characters: 0,
      lastBookModified: 0,
      lastBookOpen: 0,
      progress: 0,
      lastBookmarkModified: 0,
      isPlaceholder: false
    };

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
      }
    }

    this.titleToFiles.set(title, files);
    this.titleToBookCard.set(title, bookCard);
  }
}
