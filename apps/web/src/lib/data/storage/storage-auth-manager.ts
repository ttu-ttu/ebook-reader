/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbStorageSource } from '../database/books-db/versions/books-db';
import type { StorageUnlockAction } from './storage-source-manager';

export enum AuthType {
  OAUTH = 'oauth',
  BASIC = 'basic'
}

export interface StorageAuthManager {
  getAuthType(): AuthType;

  getToken(
    window: Window,
    storageSourceName: string,
    askForStorageUnlock: boolean,
    authWindow: Window
  ): Promise<string | undefined>;

  getToken(
    window: Window,
    storageSourceName: string,
    askForStorageUnlock: boolean,
    authWindow?: Window | null,
    oldUnlockResult?: StorageUnlockAction,
    oldStorageSource?: BooksDbStorageSource | undefined
  ): Promise<string | undefined>;
}
