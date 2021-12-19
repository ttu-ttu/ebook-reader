/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { deleteDB, IDBPDatabase, openDB } from 'idb';
import BooksDbV3 from './books-db';

class DatabaseManager<T> {
  dbPromise?: Promise<IDBPDatabase<T>>;

  private blocked = false;

  constructor(
    private name: string,
    private version: number,
    private initFn: (emptyDb: IDBPDatabase<T>) => void
  ) {}

  async openDb() {
    this.dbPromise = openDB<T>(this.name, this.version, {
      upgrade: (oldDb, oldVersion) => {
        if (oldVersion === 0) {
          this.initFn(oldDb);
          return;
        }

        if (oldVersion !== this.version) {
          throw new Error('Unknown version');
        }
      },
    });
    return this.dbPromise;
  }

  async closeDb(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = undefined;
    }

    if (this.blocked) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      deleteDB(this.name, {
        blocked: () => {
          this.blocked = true;
          resolve();
        },
      })
        .then(() => {
          this.blocked = false;
          resolve();
        })
        .catch(reject);
    });
  }
}

export const databaseManager = new DatabaseManager<BooksDbV3>(
  'books',
  3,
  (emptyDb) => {
    const dataStore = emptyDb.createObjectStore('data', {
      keyPath: 'id',
      autoIncrement: true,
    });
    dataStore.createIndex('title', 'title');

    emptyDb.createObjectStore('bookmark', {
      keyPath: 'dataId',
    });

    emptyDb.createObjectStore('lastItem');
  }
);

export type BooksDbBookData = BooksDbV3['data']['value'];
