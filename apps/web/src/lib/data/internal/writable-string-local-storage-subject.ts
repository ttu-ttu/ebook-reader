/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { writableStorageSubject } from './writable-storage-subject';
import { localStorage, type LocalStorage } from '../window/local-storage';

export function writableStringLocalStorageSubject<T extends string>(
  storage: LocalStorage = localStorage
) {
  return writableStorageSubject(
    storage,
    (x) => x as T,
    (x) => x
  );
}
