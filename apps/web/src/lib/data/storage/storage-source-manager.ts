/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import {
  StorageKey,
  StorageSourceDefault,
  internalStorageSourceName
} from '$lib/data/storage/storage-types';
import { fsStorageSource$, gDriveStorageSource$, oneDriveStorageSource$ } from '$lib/data/store';

import type { BooksDbStorageSource } from '$lib/data/database/books-db/versions/books-db';
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
    name === internalStorageSourceName
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
