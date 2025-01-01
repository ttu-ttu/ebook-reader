/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import type { FsHandle, RemoteContext } from '$lib/data/storage/storage-source-manager';

import type { DBSchema } from 'idb';
import type { ReadingGoal } from '$lib/data/reading-goal';
import type { StorageKey } from '$lib/data/storage/storage-types';

interface BooksDbV5BookData {
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

interface BooksDbV5BookmarkData {
  dataId: number;
  scrollX?: number;
  scrollY?: number;
  exploredCharCount?: number;
  progress: number | string | undefined;
  lastBookmarkModified: number;
}

interface BooksDbV5StorageSource {
  name: string;
  type: StorageKey;
  data: FsHandle | ArrayBuffer | RemoteContext;
  storedInManager: boolean;
  encryptionDisabled: boolean;
  lastSourceModified: number;
}

interface BooksDbV5Statistic {
  title: string;
  dateKey: string;
  charactersRead: number;
  readingTime: number;
  minReadingSpeed: number;
  altMinReadingSpeed: number;
  lastReadingSpeed: number;
  maxReadingSpeed: number;
  lastStatisticModified: number;
  completedBook?: number;
  completedData?: Omit<BooksDbV5Statistic, 'title' | 'lastStatisticModified'>;
}

interface BooksDbV5ReadingGoal extends ReadingGoal {
  goalEndDate: string;
  goalOriginalEndDate: string;
}

interface BooksDbV5LastModified {
  title: string;
  dataType: string;
  lastModifiedValue: number;
}

export interface Section {
  reference: string;
  charactersWeight: number;
  label?: string;
  startCharacter?: number;
  characters?: number;
  parentChapter?: string;
}

export default interface BooksDbV5 extends DBSchema {
  data: {
    key: number;
    value: BooksDbV5BookData;
    indexes: {
      title: string;
    };
  };
  bookmark: {
    key: number;
    value: BooksDbV5BookmarkData;
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
    value: BooksDbV5StorageSource;
  };
  statistic: {
    key: string[];
    value: BooksDbV5Statistic;
    indexes: {
      dateKey: string;
      completedBook: (string | number | [])[];
    };
  };
  readingGoal: {
    key: string;
    value: BooksDbV5ReadingGoal;
    indexes: {
      goalEndDate: string;
    };
  };
  lastModified: {
    key: string[];
    value: BooksDbV5LastModified;
  };
}
