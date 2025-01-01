/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import { writableStorageSubject } from './writable-storage-subject';
import { localStorage } from '../window/local-storage';

export function writableStringLocalStorageSubject<T extends string>(storage = localStorage) {
  return writableStorageSubject(
    storage,
    (x) => x as T,
    (x) => x
  );
}
