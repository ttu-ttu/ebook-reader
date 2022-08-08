/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { BrowserStorageHandler } from '$lib/data/storage-manager/browser-handler';
import { StorageKey } from '$lib/data/storage-manager/storage-source';

let browserStorageHandler: BrowserStorageHandler;

export async function getStorageHandler(type: StorageKey, window: Window) {
  switch (type) {
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
