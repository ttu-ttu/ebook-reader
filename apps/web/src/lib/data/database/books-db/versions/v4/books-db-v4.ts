/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import type { DBSchema } from 'idb';
import type { FsHandle } from '$lib/data/storage/storage-source-manager';
import type { StorageKey } from '$lib/data/storage/storage-types';

interface BooksDbV4BookData {
  id: number;
  title: string;
  styleSheet: string;
  elementHtml: string;
  blobs: Record<string, Blob>;
  coverImage?: string | Blob;
  hasThumb: boolean;
  characters: number;
  sections?: Section[];
  lastBookModified: number;
  lastBookOpen: number;
  storageSource?: string;
}

interface BooksDbV4BookmarkData {
  dataId: number;
  scrollX?: number;
  scrollY?: number;
  exploredCharCount?: number;
  progress: number | string | undefined;
  lastBookmarkModified: number;
}

interface BooksDbV4StorageSource {
  name: string;
  type: StorageKey;
  data: FsHandle | ArrayBuffer;
  lastSourceModified: number;
}

export interface Section {
  reference: string;
  charactersWeight: number;
  label?: string;
  startCharacter?: number;
  characters?: number;
  parentChapter?: string;
}

export default interface BooksDbV4 extends DBSchema {
  data: {
    key: number;
    value: BooksDbV4BookData;
    indexes: {
      title: string;
    };
  };
  bookmark: {
    key: number;
    value: BooksDbV4BookmarkData;
    indexes: {
      dataId: number;
    };
  };
  lastItem: {
    key: number;
    value: {
      dataId: number;
    };
  };
  storageSource: {
    key: string;
    value: BooksDbV4StorageSource;
  };
}
