/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { writableStorageSubject } from './writable-storage-subject';
import { localStorage, type LocalStorage } from '../window/local-storage';

export function writableNumberLocalStorageSubject(storage: LocalStorage = localStorage) {
  return writableStorageSubject(
    storage,
    (x) => +x,
    (x) => `${x}`
  );
}
