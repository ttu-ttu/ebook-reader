/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { skip } from 'rxjs';
import type { LocalStorage } from '../window/local-storage';
import { writableSubject } from '$lib/functions/svelte/store';

export function writableStorageSubject<T>(
  storage: LocalStorage,
  mapFromString: (s: string) => T,
  mapToString: (t: T) => string
) {
  return (key: string, defaultValue: T) => {
    const initValue = getStoredOrDefault(storage)(key, defaultValue, mapFromString);
    const subject = writableSubject(initValue);
    subject.pipe(skip(1)).subscribe((updatedValue) => {
      storage.setItem(key, mapToString(updatedValue ?? defaultValue));
    });

    if ('presetChanged' in storage) {
      storage.presetChanged.subscribe(() => {
        subject.next(getStoredOrDefault(storage)(key, defaultValue, mapFromString));
      });
    }

    return subject;
  };
}

function getStoredOrDefault(storage: LocalStorage) {
  return <T>(key: string, defaultVal: T, mapFn: (s: string) => T) => {
    const stored = storage.getItem(key);
    return stored ? mapFn(stored) : defaultVal;
  };
}
