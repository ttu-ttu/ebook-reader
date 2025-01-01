/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { gDriveRefreshEndpoint } from '$lib/data/env';
import { ApiStorageHandler } from '$lib/data/storage/handler/api-handler';
import { BaseStorageHandler, type ExternalFile } from '$lib/data/storage/handler/base-handler';
import { StorageKey } from '$lib/data/storage/storage-types';
import { database, gDriveStorageSource$ } from '$lib/data/store';
import pLimit from 'p-limit';

interface GDriveFile extends ExternalFile {
  thumbnailLink?: string;
  parents: string[];
}

export class GDriveStorageHandler extends ApiStorageHandler {
  private baseFileApiUrl = 'https://www.googleapis.com/drive/v3/files';

  private baseUploadApiUrl = 'https://www.googleapis.com/upload/drive/v3/files';

  constructor(window: Window) {
    super(StorageKey.GDRIVE, window, gDriveRefreshEndpoint);
  }

  setInternalSettings(storageSourceName: string) {
    const newStorageSource = storageSourceName || gDriveStorageSource$.getValue();

    if (newStorageSource !== this.storageSourceName) {
      this.clearData();
    }

    this.storageSourceName = newStorageSource;
  }

  async getBookList() {
    if (!this.dataListFetched) {
      database.listLoading$.next(true);

      try {
        await this.ensureTitle();

        const titles = await this.list(
          `trashed=false and mimeType='application/vnd.google-apps.folder' and '${this.rootId}' in parents`,
          'files(id,name),nextPageToken'
        );
        const titleIdToName = new Map<string, string>();

        for (let index = 0, { length } = titles; index < length; index += 1) {
          const title = titles[index];
          const desanitizedTitle = BaseStorageHandler.desanitizeFilename(title.name);

          this.titleToId.set(desanitizedTitle, title.id);
          titleIdToName.set(title.id, desanitizedTitle);
        }

        if (titles.length) {
          const titleIdChunks = [];

          for (let index = 0, { length } = titles; index < length; index += 50) {
            titleIdChunks.push(titles.slice(index, index + 50).map((title) => title.id));
          }

          const listLimiter = pLimit(1);
          const listTasks: Promise<void>[] = [];

          titleIdChunks.forEach((titleIdChunk) =>
            listTasks.push(
              listLimiter(async () => {
                this.setTitleData(
                  this.groupExternalFiles(
                    await this.list(
                      `trashed=false and ('${titleIdChunk.join(`' in parents or '`)}' in parents)`,
                      'files(id,name,thumbnailLink,parents),nextPageToken'
                    ),
                    titleIdToName
                  )
                );
              })
            )
          );

          await Promise.all(listTasks).catch((error) => {
            listLimiter.clearQueue();
            throw error;
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

  protected async ensureTitle(
    name = BaseStorageHandler.rootName,
    parent = 'root',
    readOnly = false
  ) {
    if (name === BaseStorageHandler.rootName && this.rootId) {
      return this.rootId;
    }

    const externalId = this.titleToId.get(name);

    if (externalId) {
      return externalId;
    }

    const sanitizedName = BaseStorageHandler.sanitizeForFilename(name);
    const params = new URLSearchParams();

    params.append('corpora', 'user');
    params.append('spaces', 'drive');
    params.append('fields', 'files(id)');
    params.append(
      'q',
      `trashed=false and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = "${sanitizedName}"`
    );

    let titleId: string = (await this.request(`${this.baseFileApiUrl}?${params.toString()}`))
      ?.files?.[0]?.id;

    if (!titleId && !readOnly) {
      const body = JSON.stringify({
        mimeType: 'application/vnd.google-apps.folder',
        name: sanitizedName,
        parents: [parent]
      });

      const response = await this.request(this.baseFileApiUrl, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' }
      });

      titleId = response.id;
    }

    if (titleId) {
      this.titleToId.set(name, titleId);
    }

    if (titleId && name === BaseStorageHandler.rootName) {
      this.rootId = titleId;
    }

    if (!titleId && name === BaseStorageHandler.rootName) {
      throw new Error('Root folder not found');
    }

    return titleId;
  }

  protected async getExternalFiles(remoteTitleId: string) {
    if (
      (!this.cacheStorageData || !this.dataListFetched) &&
      !this.titleToFiles.has(this.currentContext.title)
    ) {
      const externalFiles = await this.list(
        `trashed=false and '${remoteTitleId}' in parents`,
        'files(id,name,thumbnailLink,parents)'
      );

      if (externalFiles.length) {
        const groupedExternalFiles = new Map<string, GDriveFile[]>();

        groupedExternalFiles.set(this.currentContext.title, externalFiles);
        this.setTitleData(groupedExternalFiles);
      }
    }

    return this.titleToFiles.get(this.currentContext.title) || [];
  }

  protected async setRootFiles() {
    if ((!this.cacheStorageData || !this.rootFileListFetched) && !this.rootFiles.size) {
      const rootFiles = await this.list(
        `trashed=false and mimeType!='application/vnd.google-apps.folder' and '${this.rootId}' in parents`,
        'files(id,name)'
      );

      for (let index = 0, { length } = rootFiles; index < length; index += 1) {
        const rootFile = rootFiles[index];

        this.setRootFile(rootFile.name, rootFile);
      }

      this.rootFileListFetched = true;
    }
  }

  protected retrieve(
    file: GDriveFile,
    typeToRetrieve: XMLHttpRequestResponseType,
    progressBase = 1
  ) {
    const params = new URLSearchParams();
    params.append('fields', 'files(name)');
    params.append('alt', 'media');

    return this.request(
      `${this.baseFileApiUrl}/${file.id}?${params.toString()}`,
      { trackDownload: true },
      typeToRetrieve,
      progressBase
    );
  }

  protected async upload(
    folderId: string,
    name: string,
    files: GDriveFile[],
    externalFile: GDriveFile | undefined,
    data: Blob | string | undefined,
    rootFilePrefix?: string,
    progressBase = 0.8
  ): Promise<GDriveFile> {
    const form = new FormData();
    const params = new URLSearchParams();

    form.append(
      'resource',
      new Blob(
        [
          JSON.stringify(
            externalFile
              ? {
                  name
                }
              : {
                  name,
                  parents: [folderId]
                }
          )
        ],
        { type: 'application/json' }
      )
    );

    if (data) {
      form.append('file', data);
    }

    params.append('uploadType', 'multipart');

    const response = await this.request(
      `${this.baseUploadApiUrl}${externalFile ? `/${externalFile.id}` : ''}?${params.toString()}`,
      { method: externalFile ? 'PATCH' : 'POST', body: form, trackUpload: true },
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

  protected executeDelete(id: string) {
    return this.request(`${this.baseFileApiUrl}/${id}`, { method: 'DELETE' });
  }

  private async list(
    query: string,
    fields: string,
    files: GDriveFile[] = [],
    pageToken = ''
  ): Promise<GDriveFile[]> {
    const params = new URLSearchParams();
    params.append('corpora', 'user');
    params.append('spaces', 'drive');
    params.append('fields', fields);
    params.append('q', query);

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const response = await this.request(`${this.baseFileApiUrl}?${params.toString()}`);

    if (response) {
      files.push(...(response.files || []));

      if (response.nextPageToken) {
        await this.list(query, fields, files, response.nextPageToken);
      }
    }

    return files;
  }

  private groupExternalFiles(remoteFiles: GDriveFile[], titleIdToName: Map<string, string>) {
    const groupedExternalFiles = new Map<string, GDriveFile[]>();

    for (let index = 0, { length } = remoteFiles; index < length; index += 1) {
      const remoteFile = remoteFiles[index];
      const title = titleIdToName.get(remoteFile.parents[0]);

      if (title) {
        const groupedFiles = groupedExternalFiles.get(title) || [];

        groupedFiles.push(remoteFile);
        groupedExternalFiles.set(title, groupedFiles);
      }
    }

    return groupedExternalFiles;
  }

  private setTitleData(groupedExternalFiles: Map<string, GDriveFile[]>) {
    const entries = [...groupedExternalFiles.entries()];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const [title, files] = entries[index];

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

      for (let index2 = 0, { length: length2 } = files; index2 < length2; index2 += 1) {
        const file = files[index2];

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
        } else if (file.name.startsWith('cover_') && file.thumbnailLink) {
          bookCard.imagePath = file.thumbnailLink.replace(/=s\d+$/, '=s720');
        }
      }

      this.titleToFiles.set(title, files);
      this.titleToBookCard.set(title, bookCard);
    }
  }
}
