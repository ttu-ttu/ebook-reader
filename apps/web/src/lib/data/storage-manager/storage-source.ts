/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

interface StorageIcon {
  d: string;
  viewBox: string;
}

export enum StorageDataType {
  DATA = 'data',
  PROGRESS = 'bookmark'
}

export interface StorageIconElement extends StorageIcon {
  label: string;
  source: StorageKey;
}

export enum StorageKey {
  BACKUP = 'backup',
  BROWSER = 'browser'
}

export function getStorageIconData(storageSource: StorageKey): StorageIcon {
  switch (storageSource) {
    case StorageKey.BACKUP:
      return {
        viewBox: '0 0 384 512',
        d: 'M256 0v128h128L256 0zM224 128L224 0H48C21.49 0 0 21.49 0 48v416C0 490.5 21.49 512 48 512h288c26.51 0 48-21.49 48-48V160h-127.1C238.3 160 224 145.7 224 128zM96 32h64v32H96V32zM96 96h64v32H96V96zM96 160h64v32H96V160zM128.3 415.1c-40.56 0-70.76-36.45-62.83-75.45L96 224h64l30.94 116.9C198.7 379.7 168.5 415.1 128.3 415.1zM144 336h-32C103.2 336 96 343.2 96 352s7.164 16 16 16h32C152.8 368 160 360.8 160 352S152.8 336 144 336z'
      };
    default:
      return {
        viewBox: '0 0 512 512',
        d: 'M448 32C483.3 32 512 60.65 512 96V416C512 451.3 483.3 480 448 480H64C28.65 480 0 451.3 0 416V96C0 60.65 28.65 32 64 32H448zM96 96C78.33 96 64 110.3 64 128C64 145.7 78.33 160 96 160H416C433.7 160 448 145.7 448 128C448 110.3 433.7 96 416 96H96z'
      };
  }
}
