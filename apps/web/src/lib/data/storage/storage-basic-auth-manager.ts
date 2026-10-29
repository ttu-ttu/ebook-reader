/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { unlockStorageData } from '$lib/data/storage/storage-source-manager';
import { StorageSourceDefault } from '$lib/data/storage/storage-types';
import { database } from '$lib/data/store';
import { AuthType, type StorageAuthManager } from './storage-auth-manager';

export class StorageBasicAuthManager implements StorageAuthManager {
  getAuthType(): AuthType {
    return AuthType.BASIC;
  }
  async getToken(
    _window: Window,
    storageSourceName: string,
    askForStorageUnlock: boolean,
    _authWindow: Window
  ): Promise<string | undefined> {
    switch (storageSourceName) {
      case StorageSourceDefault.GDRIVE_DEFAULT:
        throw new Error('Google Drive does not support basic auth.');
      case StorageSourceDefault.ONEDRIVE_DEFAULT:
        throw new Error('One Drive does not support basic auth.');
      case StorageSourceDefault.TTSU_REMOTE_DEFAULT:
        break;
    }

    const db = await database.db;
    const storageSource = await db.get('storageSource', storageSourceName);

    if (!storageSource) {
      throw new Error(`No storage source with name ${storageSourceName} found`);
    }

    const unlockResult = await unlockStorageData(
      storageSource,
      'You are trying to access protected data',
      askForStorageUnlock
        ? {
            action: `Enter the correct password for ${storageSourceName} and login to your account if required to proceed`,
            encryptedData: storageSource.data,
            forwardSecret: true
          }
        : undefined
    );

    if (!unlockResult) {
      throw new Error(`Unable to unlock required data`);
    }

    const token = btoa(`${unlockResult.clientId}:${unlockResult.clientSecret}`);

    return token;
  }
}
