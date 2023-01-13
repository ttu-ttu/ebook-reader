/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { StorageKey, StorageSourceDefault } from '$lib/data/storage/storage-types';
import {
  gDriveAuthEndpoint,
  gDriveClientId,
  gDriveScope,
  oneDriveAuthEndpoint,
  oneDriveClientId,
  oneDriveScope
} from '$lib/data/env';

import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';
import { writableSubject } from '$lib/functions/svelte/store';

interface StorageIcon {
  d: string;
  viewBox: string;
}

export interface StorageIconElement extends StorageIcon {
  label: string;
  source: StorageKey;
}

export function isStorageSourceAvailable(
  storageSource: StorageKey,
  storageSourceManager: string,
  window: Window
) {
  let hasValidEnvironment = false;

  switch (storageSource) {
    case StorageKey.BROWSER:
      hasValidEnvironment = true;
      break;

    case StorageKey.GDRIVE:
      hasValidEnvironment =
        ((storageSourceManager && storageSourceManager !== StorageSourceDefault.GDRIVE_DEFAULT) ||
          gDriveClientId) &&
        gDriveAuthEndpoint &&
        gDriveScope;
      break;

    case StorageKey.ONEDRIVE:
      hasValidEnvironment =
        ((storageSourceManager && storageSourceManager !== StorageSourceDefault.ONEDRIVE_DEFAULT) ||
          oneDriveClientId) &&
        oneDriveAuthEndpoint &&
        oneDriveScope;
      break;

    case StorageKey.FS:
      hasValidEnvironment = !!storageSourceManager && 'showDirectoryPicker' in window;
      break;

    default:
      break;
  }

  return hasValidEnvironment;
}

export function getStorageIconData(storageSource: StorageKey): StorageIcon {
  switch (storageSource) {
    case StorageKey.BACKUP:
      return {
        viewBox: '0 0 384 512',
        d: 'M256 0v128h128L256 0zM224 128L224 0H48C21.49 0 0 21.49 0 48v416C0 490.5 21.49 512 48 512h288c26.51 0 48-21.49 48-48V160h-127.1C238.3 160 224 145.7 224 128zM96 32h64v32H96V32zM96 96h64v32H96V96zM96 160h64v32H96V160zM128.3 415.1c-40.56 0-70.76-36.45-62.83-75.45L96 224h64l30.94 116.9C198.7 379.7 168.5 415.1 128.3 415.1zM144 336h-32C103.2 336 96 343.2 96 352s7.164 16 16 16h32C152.8 368 160 360.8 160 352S152.8 336 144 336z'
      };
    case StorageKey.GDRIVE:
      return {
        viewBox: '0 0 512 512',
        d: 'M339 314.9L175.4 32h161.2l163.6 282.9H339zm-137.5 23.6L120.9 480h310.5L512 338.5H201.5zM154.1 67.4L0 338.5 80.6 480 237 208.8 154.1 67.4z'
      };
    case StorageKey.ONEDRIVE:
      return {
        viewBox: '0 0 640 512',
        d: 'M96.2 200.1C96.07 197.4 96 194.7 96 192C96 103.6 167.6 32 256 32C315.3 32 367 64.25 394.7 112.2C409.9 101.1 428.3 96 448 96C501 96 544 138.1 544 192C544 204.2 541.7 215.8 537.6 226.6C596 238.4 640 290.1 640 352C640 422.7 582.7 480 512 480H144C64.47 480 0 415.5 0 336C0 273.2 40.17 219.8 96.2 200.1z'
      };
    case StorageKey.FS:
      return {
        viewBox: '0 0 576 512',
        d: 'M544 32h-112l-32-32H320c-17.62 0-32 14.38-32 32v160c0 17.62 14.38 32 32 32h224c17.62 0 32-14.38 32-32V64C576 46.38 561.6 32 544 32zM544 320h-112l-32-32H320c-17.62 0-32 14.38-32 32v160c0 17.62 14.38 32 32 32h224c17.62 0 32-14.38 32-32v-128C576 334.4 561.6 320 544 320zM64 16C64 7.125 56.88 0 48 0h-32C7.125 0 0 7.125 0 16V416c0 17.62 14.38 32 32 32h224v-64H64V160h192V96H64V16z'
      };
    default:
      return {
        viewBox: '0 0 512 512',
        d: 'M448 32C483.3 32 512 60.65 512 96V416C512 451.3 483.3 480 448 480H64C28.65 480 0 451.3 0 416V96C0 60.65 28.65 32 64 32H448zM96 96C78.33 96 64 110.3 64 128C64 145.7 78.33 160 96 160H416C433.7 160 448 145.7 448 128C448 110.3 433.7 96 416 96H96z'
      };
  }
}

export const storageSource$ = writableStringLocalStorageSubject<StorageKey>()(
  'lastStorageSource',
  StorageKey.BROWSER
);

export const storageIcon$ = writableSubject<StorageIcon>(getStorageIconData(StorageKey.BROWSER));

storageSource$.subscribe((storageSource) => storageIcon$.next(getStorageIconData(storageSource)));
