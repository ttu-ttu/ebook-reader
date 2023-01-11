/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { StorageKey, internalStorageSourceName } from '$lib/data/storage/storage-types';

import { BackupStorageHandler } from '$lib/data/storage/handler/backup-handler';
import type { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
import { BrowserStorageHandler } from '$lib/data/storage/handler/browser-handler';
import { FilesystemStorageHandler } from '$lib/data/storage/handler/filesystem-handler';
import { GDriveStorageHandler } from '$lib/data/storage/handler/gdrive-handler';
import { OneDriveStorageHandler } from '$lib/data/storage/handler/onedrive-handler';
import { ReplicationSaveBehavior } from '$lib/functions/replication/replication-options';

let backupStorageHandler: BackupStorageHandler;
let browserStorageHandler: BrowserStorageHandler;
let gDriveStorageHandler: GDriveStorageHandler;
let oneDriveStorageHandler: OneDriveStorageHandler;
let fsStorageHandler: FilesystemStorageHandler;

export function getStorageHandler(
  window: Window,
  storageType: StorageKey.BACKUP,
  storageSourceName?: string,
  isForBrowser?: boolean,
  cacheStorageData?: boolean,
  saveBehavior?: ReplicationSaveBehavior,
  askForStorageUnlock?: boolean
): BackupStorageHandler;
export function getStorageHandler(
  window: Window,
  storageType: StorageKey.BROWSER,
  storageSourceName?: string,
  isForBrowser?: boolean,
  cacheStorageData?: boolean,
  saveBehavior?: ReplicationSaveBehavior,
  askForStorageUnlock?: boolean
): BrowserStorageHandler;
export function getStorageHandler(
  window: Window,
  storageType: StorageKey.GDRIVE,
  storageSourceName?: string,
  isForBrowser?: boolean,
  cacheStorageData?: boolean,
  saveBehavior?: ReplicationSaveBehavior,
  askForStorageUnlock?: boolean
): GDriveStorageHandler;
export function getStorageHandler(
  window: Window,
  storageType: StorageKey.ONEDRIVE,
  storageSourceName?: string,
  isForBrowser?: boolean,
  cacheStorageData?: boolean,
  saveBehavior?: ReplicationSaveBehavior,
  askForStorageUnlock?: boolean
): OneDriveStorageHandler;
export function getStorageHandler(
  window: Window,
  storageType: StorageKey.FS,
  storageSourceName?: string,
  isForBrowser?: boolean,
  cacheStorageData?: boolean,
  saveBehavior?: ReplicationSaveBehavior,
  askForStorageUnlock?: boolean
): FilesystemStorageHandler;
export function getStorageHandler(
  window: Window,
  storageType: StorageKey,
  storageSourceName?: string,
  isForBrowser?: boolean,
  cacheStorageData?: boolean,
  saveBehavior?: ReplicationSaveBehavior,
  askForStorageUnlock?: boolean
): BaseStorageHandler;
export function getStorageHandler(
  window: Window,
  storageType: StorageKey,
  storageSourceName = internalStorageSourceName,
  isForBrowser = false,
  cacheStorageData = false,
  saveBehavior = ReplicationSaveBehavior.NewOnly,
  askForStorageUnlock = true
) {
  switch (storageType) {
    case StorageKey.BACKUP:
      backupStorageHandler =
        backupStorageHandler || new BackupStorageHandler(window, StorageKey.BACKUP);
      backupStorageHandler.updateSettings(window, isForBrowser);

      return backupStorageHandler;
    case StorageKey.BROWSER:
      browserStorageHandler =
        browserStorageHandler || new BrowserStorageHandler(window, StorageKey.BROWSER);
      browserStorageHandler.updateSettings(window, true, saveBehavior);

      return browserStorageHandler;
    case StorageKey.GDRIVE:
      gDriveStorageHandler = gDriveStorageHandler || new GDriveStorageHandler(window);
      gDriveStorageHandler.updateSettings(
        window,
        isForBrowser,
        saveBehavior,
        cacheStorageData,
        askForStorageUnlock,
        storageSourceName
      );

      return gDriveStorageHandler;
    case StorageKey.ONEDRIVE:
      oneDriveStorageHandler = oneDriveStorageHandler || new OneDriveStorageHandler(window);
      oneDriveStorageHandler.updateSettings(
        window,
        isForBrowser,
        saveBehavior,
        cacheStorageData,
        askForStorageUnlock,
        storageSourceName
      );

      return oneDriveStorageHandler;
    case StorageKey.FS:
      fsStorageHandler = fsStorageHandler || new FilesystemStorageHandler(window, StorageKey.FS);
      fsStorageHandler.updateSettings(
        window,
        isForBrowser,
        saveBehavior,
        cacheStorageData,
        askForStorageUnlock,
        storageSourceName
      );

      return fsStorageHandler;
    default:
      throw new Error(`No handler implementation for ${storageType}`);
  }
}
