/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
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
  PROGRESS = 'bookmark',
  STATISTICS = 'statistic',
  READING_GOALS = 'readingGoal',
  AUDIOBOOK = 'audioBook',
  SUBTITLE = 'subtitle'
}

export enum StorageSourceDefault {
  GDRIVE_DEFAULT = 'ttu-gdrive-default',
  ONEDRIVE_DEFAULT = 'ttu-onedrive-default'
}

export enum InternalStorageSources {
  INTERNAL_DEFAULT = 'ttu-internal-source',
  INTERNAL_BROWSER = 'ttu-internal-browser',
  INTERNAL_ZIP = 'ttu-internal-zip'
}

export const internalStorageSourceName = new Set<string>([
  InternalStorageSources.INTERNAL_DEFAULT,
  InternalStorageSources.INTERNAL_BROWSER,
  InternalStorageSources.INTERNAL_ZIP
]);

export const defaultStorageSources = [
  { name: StorageSourceDefault.GDRIVE_DEFAULT, type: StorageKey.GDRIVE },
  { name: StorageSourceDefault.ONEDRIVE_DEFAULT, type: StorageKey.ONEDRIVE }
];
