/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { map } from 'rxjs';
import { writable } from 'svelte/store';
import { browser } from '$app/env';
import { writableSubject } from '$lib/functions/svelte/store';
import { DatabaseService } from './database/books-db/database.service';
import { createBooksDb } from './database/books-db/factory';
import { FuriganaStyle } from './furigana-style';
import { writableBooleanLocalStorageSubject } from './internal/writable-boolean-local-storage-subject';
import { writableNumberLocalStorageSubject } from './internal/writable-number-local-storage-subject';
import { writableStringLocalStorageSubject } from './internal/writable-string-local-storage-subject';
import type { WritingMode } from './writing-mode';
import { BookReaderAvailableKeybind, type BookReaderKeybindMap } from './book-reader-keybind';
import { ViewMode } from './view-mode';

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
  ViewMode.Continuous
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

export const pageColumns$ = writableNumberLocalStorageSubject()('pageColumns', 0);

export const requestPersistentStorage$ = writableBooleanLocalStorageSubject()(
  'requestPersistentStorage',
  true
);

export const bookReaderKeybindMap$ = writableSubject<BookReaderKeybindMap>({
  KeyB: BookReaderAvailableKeybind.BOOKMARK,
  KeyR: BookReaderAvailableKeybind.JUMP_TO_BOOKMARK,
  PageDown: BookReaderAvailableKeybind.NEXT_PAGE,
  PageUp: BookReaderAvailableKeybind.PREV_PAGE,
  Space: BookReaderAvailableKeybind.AUTO_SCROLL_TOGGLE,
  KeyA: BookReaderAvailableKeybind.AUTO_SCROLL_INCREASE,
  KeyD: BookReaderAvailableKeybind.AUTO_SCROLL_DECREASE
});

const db = browser ? createBooksDb() : import('fake-indexeddb/auto.js').then(() => createBooksDb());

export const database = new DatabaseService(db);

/* eslint-disable no-param-reassign */
function popoverStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,
    add(instance: never) {
      this.update((instances) => {
        instances.push(instance);
        return instances;
      });
    },
    replace(instance: never) {
      this.update((instances) => {
        instances = [instance];
        return instances;
      });
    },
    remove(instance: string) {
      this.update((instances) => {
        instances = instances.filter((item) => item !== instance);
        return instances;
      });
    }
  };
}
/* eslint-enable no-param-reassign */

export const popovers = popoverStore();
