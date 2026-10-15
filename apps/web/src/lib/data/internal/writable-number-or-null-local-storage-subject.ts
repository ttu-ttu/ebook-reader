/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { localStorage } from '../window/local-storage';
import { writableStorageSubject } from './writable-storage-subject';

export function writableNumberOrNullLocalStorageSubject(storage = localStorage) {
  return writableStorageSubject<number | null>(
    storage,
    (x) => (x === 'null' ? null : +x),
    (x) => `${x}`
  );
}
