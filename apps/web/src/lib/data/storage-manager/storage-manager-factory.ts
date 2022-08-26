/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { BackupStorageHandler } from '$lib/data/storage-manager/backup-handler';
import { BrowserStorageHandler } from '$lib/data/storage-manager/browser-handler';
import { StorageKey } from '$lib/data/storage-manager/storage-source';

let backupStorageHandler: BackupStorageHandler;
let browserStorageHandler: BrowserStorageHandler;

export async function getStorageHandler(type: StorageKey, window: Window) {
  switch (type) {
    case StorageKey.BACKUP:
      if (!backupStorageHandler) {
        backupStorageHandler = new BackupStorageHandler(window);
      }

      await backupStorageHandler.init(window);

      return backupStorageHandler;
    case StorageKey.BROWSER:
      if (!browserStorageHandler) {
        browserStorageHandler = new BrowserStorageHandler(window);
      }

      await browserStorageHandler.init(window);

      return browserStorageHandler;
    default:
      throw new Error(`No Handler Implementation for ${type}`);
  }
}
