/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import {
  StorageKey,
  StorageSourceDefault,
  internalStorageSourceName
} from '$lib/data/storage/storage-types';
import { fsStorageSource$, gDriveStorageSource$, oneDriveStorageSource$ } from '$lib/data/store';

import type { BooksDbStorageSource } from '$lib/data/database/books-db/versions/books-db';
import StorageUnlock from '$lib/components/storage-unlock.svelte';
import { dialogManager } from '$lib/data/dialog-manager';
import { logger } from '$lib/data/logger';
import { storageSource$ } from '$lib/data/storage/storage-view';

const saltByteLength = 16;
const ivByteLength = 12;

async function generateKey(window: Window, salt: Uint8Array, secret: string) {
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    ),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface FsHandle {
  directoryHandle: FileSystemDirectoryHandle;
  fsPath: string;
}

export interface RemoteContext {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
}

export interface StorageSourceSaveResult {
  new: BooksDbStorageSource;
  old?: string;
}

export interface StorageUnlockAction extends RemoteContext {
  secret?: string;
}

export function isAppDefault(name: string) {
  return (
    name === StorageSourceDefault.GDRIVE_DEFAULT ||
    name === StorageSourceDefault.ONEDRIVE_DEFAULT ||
    internalStorageSourceName.has(name)
  );
}

export function setStorageSourceDefault(name: string, type: StorageKey) {
  switch (type) {
    case StorageKey.GDRIVE:
      gDriveStorageSource$.next(name || StorageSourceDefault.GDRIVE_DEFAULT);
      break;
    case StorageKey.ONEDRIVE:
      oneDriveStorageSource$.next(name || StorageSourceDefault.ONEDRIVE_DEFAULT);
      break;
    case StorageKey.FS:
      fsStorageSource$.next(name);
      break;
    default:
      break;
  }

  if (!name && type === StorageKey.FS) {
    storageSource$.next(StorageKey.BROWSER);
  }
}

export async function encrypt(window: Window, payload: string, secret: string) {
  const allByteLength = saltByteLength + ivByteLength;
  const salt = window.crypto.getRandomValues(new Uint8Array(saltByteLength));
  const iv = window.crypto.getRandomValues(new Uint8Array(ivByteLength));
  const data = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    await generateKey(window, salt, secret),
    new TextEncoder().encode(payload)
  );
  const tempBuffer = new Uint8Array(data.byteLength + allByteLength);
  tempBuffer.set(new Uint8Array(salt), 0);
  tempBuffer.set(new Uint8Array(iv), salt.byteLength);
  tempBuffer.set(new Uint8Array(data), allByteLength);

  return tempBuffer.buffer;
}

export async function decrypt(window: Window, encryptedData: ArrayBuffer, secret: string) {
  const allByteLength = saltByteLength + ivByteLength;
  const salt = encryptedData.slice(0, saltByteLength);
  const iv = encryptedData.slice(saltByteLength, allByteLength);
  const data = encryptedData.slice(allByteLength);
  const key = await generateKey(window, new Uint8Array(salt), secret);

  return window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
}

export async function unlockStorageData(
  storageSource: BooksDbStorageSource | undefined,
  unlockDescription: string,
  unlockProps?: Record<string, any>
) {
  let unlockResult: StorageUnlockAction | undefined;
  let description = unlockDescription;

  if (storageSource && storageSource.type !== StorageKey.FS) {
    if (storageSource.storedInManager && storageSource.data instanceof ArrayBuffer) {
      const passwordCredential: PasswordCredential | undefined = await navigator.credentials
        .get({ password: true })
        .then((credentials) =>
          credentials instanceof PasswordCredential ? credentials : undefined
        )
        .catch(({ message }: any) => {
          logger.error(`Error getting Password from Manager: ${message}`);

          return undefined;
        });

      if (passwordCredential?.password) {
        try {
          unlockResult = JSON.parse(
            new TextDecoder().decode(
              await decrypt(window, storageSource.data, passwordCredential.password)
            )
          );

          if (unlockResult) {
            unlockResult.secret = passwordCredential.password;
          }
        } catch ({ message }: any) {
          description += ' but the provided Credentials were invalid';
          logger.error(
            `Error decrypting Data with Credential ${passwordCredential.id}: ${message}`
          );
        }
      }
    } else if (isRemoteContext(storageSource.data)) {
      unlockResult = storageSource.data;
    }
  }

  if (!unlockResult && unlockProps) {
    unlockResult = await new Promise<StorageUnlockAction | undefined>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: StorageUnlock,
          props: {
            ...unlockProps,
            description,
            resolver
          },
          disableCloseOnClick: true
        }
      ]);
    });
  }

  return unlockResult;
}

export function isRemoteContext(
  data: FsHandle | ArrayBuffer | RemoteContext
): data is RemoteContext {
  return !!(data && 'clientId' in data && data.clientId);
}
