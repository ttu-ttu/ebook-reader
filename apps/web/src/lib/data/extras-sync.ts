/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Syncs "Story so far" recaps (recaps.json) and the lorebook (lorebook.json) of
 * Calibre books through the book's sync folder, the account's own folder while
 * signed in, like annotations.json. Local changes upload a second after they
 * are saved; panels pull before showing. Browser copies record their account
 * and are ignored under another sign-in state. Not part of upstream.
 */

import { BehaviorSubject, type Subject } from 'rxjs';
import { accountReady, currentAccount } from '$lib/data/account';
import { logger } from '$lib/data/logger';
import { lorebookChanged$, mergeLorebooks, sameLorebooks, type Lorebook } from '$lib/data/lorebook';
import { mergeRecaps, recapsChanged$, sameRecaps, type BookRecaps } from '$lib/data/recap';
import { readerDb } from '$lib/data/reader-db';
import { CalibreStorageHandler } from '$lib/data/storage/handler/calibre-handler';

export type ExtrasKind = 'recaps' | 'lorebook';

interface Spec<T extends { title: string; account?: string }> {
  store: 'recaps' | 'lorebooks';
  file: string;
  changed$: Subject<T>;
  merge: (title: string, local?: T, remote?: T) => T;
  same: (a?: T, b?: T) => boolean;
}

const specs: { recaps: Spec<BookRecaps>; lorebook: Spec<Lorebook> } = {
  recaps: {
    store: 'recaps',
    file: 'recaps.json',
    changed$: recapsChanged$,
    merge: mergeRecaps,
    same: sameRecaps
  },
  lorebook: {
    store: 'lorebooks',
    file: 'lorebook.json',
    changed$: lorebookChanged$,
    merge: mergeLorebooks,
    same: sameLorebooks
  }
};

/** Last sync error per kind ('' when fine), shown in the panels. */
export const extrasSyncError$ = new BehaviorSubject<Record<ExtrasKind, string>>({
  recaps: '',
  lorebook: ''
});

const syncedTitles = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queues = new Map<string, Promise<void>>();
/** Copies being written by a sync, so their change events don't start another one. */
const applying = new Set<string>();

/** Turns syncing on for a book (Calibre books, when the reader opens them). */
export function enableExtrasSync(title: string) {
  syncedTitles.add(title);
}

export function isExtrasSynced(title: string) {
  return syncedTitles.has(title);
}

function schedule(kind: ExtrasKind, title: string) {
  const key = `${kind}\n${title}`;

  if (!syncedTitles.has(title) || applying.has(key)) {
    return;
  }

  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      syncExtras(kind, title);
    }, 1000)
  );
}

recapsChanged$.subscribe((recaps) => schedule('recaps', recaps.title));
lorebookChanged$.subscribe((lorebook) => schedule('lorebook', lorebook.title));

/** Pulls and pushes now (queued after a running sync); resolves without syncing for other books. */
export function syncExtras(kind: ExtrasKind, title: string): Promise<void> {
  if (!syncedTitles.has(title)) {
    return Promise.resolve();
  }

  const key = `${kind}\n${title}`;
  const next = (queues.get(key) ?? Promise.resolve()).then(() =>
    kind === 'recaps'
      ? syncOnce(kind, specs.recaps, title, key)
      : syncOnce(kind, specs.lorebook, title, key)
  );

  queues.set(key, next);

  return next;
}

function setError(kind: ExtrasKind, message: string) {
  extrasSyncError$.next({ ...extrasSyncError$.getValue(), [kind]: message });
}

async function syncOnce<T extends { title: string; account?: string }>(
  kind: ExtrasKind,
  spec: Spec<T>,
  title: string,
  key: string
) {
  try {
    await accountReady();

    const owner = currentAccount()?.id ?? '';
    const url = CalibreStorageHandler.syncFileUrl(title, spec.file);
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}`);
    }

    const remote = response.ok ? ((await response.json()) as T) : undefined;
    // Read, merge and write in one transaction, so a save made during the fetch isn't lost.
    const tx = (await readerDb()).transaction(spec.store, 'readwrite');
    const stored = (await tx.store.get(title)) as T | undefined;
    // Another sign-in state's copy stays out of this account (it is on that account's server).
    const local = stored && (stored.account ?? owner) === owner ? stored : undefined;
    const merged = spec.merge(title, local, remote);
    const changed = !spec.same(merged, stored) || stored?.account !== owner;

    if (changed) {
      await tx.store.put({ ...merged, account: owner } as never);
    }

    await tx.done;

    if (changed) {
      applying.add(key);
      try {
        spec.changed$.next(merged);
      } finally {
        applying.delete(key);
      }
    }

    if (!spec.same(merged, remote)) {
      const { account: _account, ...upload } = merged;
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upload)
      });

      if (!put.ok) {
        throw new Error(`upload failed (HTTP ${put.status})`);
      }
    }

    setError(kind, '');
  } catch (error: any) {
    const message = `${kind === 'recaps' ? 'Recap' : 'Lorebook'} sync failed: ${error.message}`;

    logger.warn(message);
    setError(kind, message);
  }
}
