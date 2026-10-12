/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * The browser database for reader extras (highlights, "Story so far" summaries,
 * lorebooks, audiobooks and kanji seen), separate from upstream's books
 * database. Not part of upstream.
 */

import { openDB, type DBSchema } from 'idb';
import type { BookAnnotations } from '$lib/data/annotations';
import type { BookAudiobook } from '$lib/data/audiobook';
import type { KanjiSeen } from '$lib/data/kanji-seen';
import type { Lorebook } from '$lib/data/lorebook';
import type { BookRecaps } from '$lib/data/recap';

interface ReaderDb extends DBSchema {
  annotations: { key: string; value: BookAnnotations };
  recaps: { key: string; value: BookRecaps };
  lorebooks: { key: string; value: Lorebook };
  audiobooks: { key: string; value: BookAudiobook };
  kanji: { key: string; value: KanjiSeen };
}

let dbPromise: ReturnType<typeof openDB<ReaderDb>> | undefined;

/** Named ttu-annotations for historical reasons; it holds every reader extra. */
export function readerDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    openDB<ReaderDb>('ttu-annotations', 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore('annotations', { keyPath: 'title' });
          database.createObjectStore('recaps', { keyPath: 'title' });
        }
        if (oldVersion < 2) {
          database.createObjectStore('lorebooks', { keyPath: 'title' });
          database.createObjectStore('audiobooks', { keyPath: 'title' });
          database.createObjectStore('kanji', { keyPath: 'title' });
        }
      },
      // Another tab still has the previous version open; the upgrade waits for it.
      blocked() {
        dbPromise = undefined;
        reject(
          new Error(
            'The reader was updated. Close or reload its other tabs, then try again (they still use the old version).'
          )
        );
      },
      // A newer version opened in another tab: let it upgrade.
      blocking(_current, _blocked, event) {
        (event.target as IDBDatabase).close();
        dbPromise = undefined;
      },
      terminated() {
        dbPromise = undefined;
      }
    }).then(resolve, reject);
  });

  return dbPromise;
}
