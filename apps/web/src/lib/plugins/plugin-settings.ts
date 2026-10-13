/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { writableArrayLocalStorageSubject } from '$lib/data/internal/writable-object-local-storage-subject';

/** Ids of plugins switched on; every plugin starts off. Synced with the account. */
export const enabledPlugins$ = writableArrayLocalStorageSubject<string>()('enabledPlugins', []);
