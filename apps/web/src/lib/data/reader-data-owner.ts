/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Keeps one reader's progress, statistics and reading goals for Calibre books from
 * showing up for, and syncing into, the next account on a shared browser. They are
 * on the server, so they come back when their reader signs in again. Not part of upstream.
 */

import type { AccountUser } from '$lib/data/account';
import { loadCalibreCatalog } from '$lib/data/calibre';
import { database } from '$lib/data/store';

const ownerKey = 'readerDataOwner';

/** Called once per page load with the session state ('' = signed out). */
export async function releaseReaderData(user: AccountUser | null) {
  const owner = window.localStorage.getItem(ownerKey);
  const id = user?.id ?? '';

  // Data from before owners were recorded is adopted, like settings.
  if (owner !== null && owner !== id) {
    // Throws when the catalog can't be read (signed out): the next page load retries.
    const titles = new Set((await loadCalibreCatalog()).map((book) => book.title));

    await database.clearReaderData(titles);
  }

  window.localStorage.setItem(ownerKey, id);
}
