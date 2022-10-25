/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { browser } from '$app/environment';
import { StorageDataType, StorageKey, StorageSourceDefault } from '$lib/data/storage/storage-types';
import {
  AutoReplicationType,
  ReplicationSaveBehavior
} from '$lib/functions/replication/replication-options';
import { writableSubject } from '$lib/functions/svelte/store';
import { map } from 'rxjs';
import { BookReaderAvailableKeybind, type BookReaderKeybindMap } from './book-reader-keybind';
import { DatabaseService } from './database/books-db/database.service';
import { createBooksDb } from './database/books-db/factory';
import { FuriganaStyle } from './furigana-style';
import { writableBooleanLocalStorageSubject } from './internal/writable-boolean-local-storage-subject';
import { writableNumberLocalStorageSubject } from './internal/writable-number-local-storage-subject';
import { writableArrayLocalStorageSubject } from './internal/writable-object-local-storage-subject';
import { writableStringLocalStorageSubject } from './internal/writable-string-local-storage-subject';
import { ViewMode } from './view-mode';
import type { WritingMode } from './writing-mode';

export const theme$ = writableStringLocalStorageSubject()('theme', 'light-theme');
export const multiplier$ = writableNumberLocalStorageSubject()('autoScrollMultiplier', 20);
export const fontSize$ = writableNumberLocalStorageSubject()('fontSize', 20);
export const fontFamilyGroupOne$ = writableStringLocalStorageSubject()('fontFamilyGroupOne', '');
export const fontFamilyGroupTwo$ = writableStringLocalStorageSubject()('fontFamilyGroupTwo', '');
export const hideSpoilerImage$ = writableBooleanLocalStorageSubject()('hideSpoilerImage', true);
export const hideFurigana$ = writableBooleanLocalStorageSubject()('hideFurigana', false);
export const furiganaStyle$ = writableStringLocalStorageSubject<FuriganaStyle>()(
  'furiganaStyle',
  FuriganaStyle.Partial
);
export const writingMode$ = writableStringLocalStorageSubject<WritingMode>()(
  'writingMode',
  'vertical-rl'
);
export const verticalMode$ = writingMode$.pipe(map((writingMode) => writingMode === 'vertical-rl'));
export const viewMode$ = writableStringLocalStorageSubject<ViewMode>()(
  'viewMode',
  ViewMode.Paginated
);

export const secondDimensionMaxValue$ = writableNumberLocalStorageSubject()(
  'secondDimensionMaxValue',
  0
);
export const firstDimensionMargin$ = writableNumberLocalStorageSubject()('firstDimensionMargin', 0);

export const autoPositionOnResize$ = writableBooleanLocalStorageSubject()(
  'autoPositionOnResize',
  true
);

export const avoidPageBreak$ = writableBooleanLocalStorageSubject()('avoidPageBreak', false);

export const autoBookmark$ = writableBooleanLocalStorageSubject()('autoBookmark', false);

export const pageColumns$ = writableNumberLocalStorageSubject()('pageColumns', 0);

export const requestPersistentStorage$ = writableBooleanLocalStorageSubject()(
  'requestPersistentStorage',
  true
);

export const confirmClose$ = writableBooleanLocalStorageSubject()('confirmClose', false);

export const cacheStorageData$ = writableBooleanLocalStorageSubject()('cacheStorageData', false);

export const autoReplication$ = writableStringLocalStorageSubject<AutoReplicationType>()(
  'autoReplication',
  AutoReplicationType.Off
);

export const replicationSaveBehavior$ =
  writableStringLocalStorageSubject<ReplicationSaveBehavior>()(
    'replicationSaveBehavior',
    ReplicationSaveBehavior.NewOnly
  );

export const showExternalPlaceholder$ = writableBooleanLocalStorageSubject()(
  'showExternalPlaceholder',
  false
);

export const gDriveStorageSource$ = writableStringLocalStorageSubject()(
  'gDriveStorageSource',
  StorageSourceDefault.GDRIVE_DEFAULT
);

export const oneDriveStorageSource$ = writableStringLocalStorageSubject()(
  'oneDriveStorageSource',
  StorageSourceDefault.ONEDRIVE_DEFAULT
);

export const fsStorageSource$ = writableStringLocalStorageSubject()('fsStorageSource', '');

export const syncTarget$ = writableStringLocalStorageSubject()('syncTarget', '');

export const lastExportedTarget$ = writableStringLocalStorageSubject<StorageKey>()(
  'lastExportedTarget',
  StorageKey.BACKUP
);

export const lastExportedTypes$ = writableArrayLocalStorageSubject<StorageDataType>()(
  'lastExportedTypes',
  [StorageDataType.PROGRESS]
);

export const bookReaderKeybindMap$ = writableSubject<BookReaderKeybindMap>({
  KeyB: BookReaderAvailableKeybind.BOOKMARK,
  KeyR: BookReaderAvailableKeybind.JUMP_TO_BOOKMARK,
  PageDown: BookReaderAvailableKeybind.NEXT_PAGE,
  PageUp: BookReaderAvailableKeybind.PREV_PAGE,
  Space: BookReaderAvailableKeybind.AUTO_SCROLL_TOGGLE,
  KeyA: BookReaderAvailableKeybind.AUTO_SCROLL_INCREASE,
  KeyD: BookReaderAvailableKeybind.AUTO_SCROLL_DECREASE,
  KeyN: BookReaderAvailableKeybind.PREV_CHAPTER,
  KeyM: BookReaderAvailableKeybind.NEXT_CHAPTER
});

const db = browser ? createBooksDb() : import('fake-indexeddb/auto').then(() => createBooksDb());

export const database = new DatabaseService(db);

export const isOnline$ = writableSubject<boolean>(true);

export const skipKeyDownListener$ = writableSubject<boolean>(false);
