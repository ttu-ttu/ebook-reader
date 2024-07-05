/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { writableStorageSubject } from './writable-storage-subject';
import { localStorage } from '../window/local-storage';

export function writableBooleanLocalStorageSubject(storage = localStorage) {
  return writableStorageSubject(
    storage,
    (x) => !!+x,
    (x) => (x ? '1' : '0')
  );
}
