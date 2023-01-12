/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

export enum StorageKey {
  BACKUP = 'backup',
  BROWSER = 'browser',
  FS = 'fs',
  GDRIVE = 'gdrive',
  ONEDRIVE = 'onedrive'
}

export enum StorageDataType {
  DATA = 'data',
  PROGRESS = 'bookmark'
}

export enum StorageSourceDefault {
  GDRIVE_DEFAULT = 'ttu-gdrive-default',
  ONEDRIVE_DEFAULT = 'ttu-onedrive-default'
}

export const internalStorageSourceName = 'ttu-internal-source';

export const defaultStorageSources = [
  { name: StorageSourceDefault.GDRIVE_DEFAULT, type: StorageKey.GDRIVE },
  { name: StorageSourceDefault.ONEDRIVE_DEFAULT, type: StorageKey.ONEDRIVE }
];
