/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

class WindowStorage {
  private _store = new Map<string, string>();

  setItem(key: string, value: string) {
    this._store.set(key, value);
  }

  getItem(key: string) {
    return this._store.get(key);
  }

  removeItem(key: string) {
    this._store.delete(key);
  }

  clear() {
    this._store = new Map();
  }
}

export const localStorage =
  typeof window === 'undefined' ? new WindowStorage() : window.localStorage;
