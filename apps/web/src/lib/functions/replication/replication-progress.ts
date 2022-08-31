/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type {
  BooksDbBookData,
  BooksDbBookmarkData
} from '$lib/data/database/books-db/versions/books-db';
import type { StorageDataType, StorageKey } from '$lib/data/storage-manager/storage-source';

import type { Entry } from '@zip.js/zip.js';
import { Subject } from 'rxjs';

export interface ReplicationContent {
  dataToReplicate: StorageDataType[];
  source: StorageKey;
  target: StorageKey;
}

export interface ReplicationContext {
  id: number;
  title: string;
  imagePath: string | Blob | Entry;
}

export interface ReplicationData {
  type: StorageDataType;
  data?: Omit<BooksDbBookData, 'id'> | File | BooksDbBookmarkData;
}

export interface ReplicationProgress {
  progressToAdd?: number;
  baseProgress?: number;
  maxProgress?: number;
  reportOnly?: boolean;
}

export const replicationProgress$ = new Subject<ReplicationProgress>();
export const replicationStart$ = new Subject<ReplicationContent>();
