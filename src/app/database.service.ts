/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, IDBPTransaction, openDB } from 'idb';

interface BooksDbV2 extends DBSchema {
  keyvaluepairs: {
    key: string;
    value: string;
  };
  'local-forage-detect-blob-support': {
    key: any;
    value: any;
  };
}

interface BooksDbV3 extends DBSchema {
  data: {
    key: number;
    value: {
      id?: number;
      title: string;
      styleSheet: string;
      elementHtml: string;
      blobs: Record<string, Blob>;
      coverImage?: Blob;
    };
    indexes: {
      title: string;
    };
  };
  bookmark: {
    key: number;
    value: {
      dataId: number;
      scrollX: number;
      exploredCharCount?: number;
      progress?: string;
    };
    indexes: {
      dataId: number;
    };
  };
  lastItem: {
    key: number;
    value: {
      dataId: number;
    };
  };
}

export type BooksDb = BooksDbV3;

const db = openDB<BooksDb>('books', 3, {
  async upgrade(oldDb, oldVersion, newVersion, transaction) {
    switch (oldVersion) {
      case 0: {
        const dataStore = oldDb.createObjectStore('data', {
          keyPath: 'id',
          autoIncrement: true,
        });
        dataStore.createIndex('title', 'title');

        oldDb.createObjectStore('bookmark', {
          keyPath: 'dataId',
        });

        oldDb.createObjectStore('lastItem');
        break;
      }
      case 2: {
        const dataStore = oldDb.createObjectStore('data', {
          keyPath: 'id',
          autoIncrement: true,
        });
        dataStore.createIndex('title', 'title');

        oldDb.createObjectStore('bookmark', {
          keyPath: 'dataId',
        });

        oldDb.createObjectStore('lastItem');

        const oldDbV2 = (oldDb as unknown) as IDBPDatabase<BooksDbV2>;
        const transactionV2 = (transaction as unknown) as IDBPTransaction<BooksDbV2>;

        const oldValues: {
          data: Record<string, string>,
          scrollX: Record<string, string>,
          lastItem?: string,
        } = {
          data: {},
          scrollX: {},
        };
        {
          let cursor = await transactionV2.objectStore('keyvaluepairs').openCursor();
          while (cursor) {
            const regexResult = /([^\-]+)-(.+)/.exec(cursor.key);
            if (regexResult) {
              switch (regexResult[1]) {
                case 'data':
                case 'scrollX':
                  oldValues[regexResult[1]][regexResult[2]] = cursor.value;
                  break;
              }
            } else if (cursor.key === 'lastItem') {
              oldValues[cursor.key] = cursor.value;
            }
            cursor = await cursor.continue();
          }
        }

        await Promise.all(
          Object.entries(oldValues.data).map(async ([key, valueString]) => {
            const parsedData = JSON.parse(valueString);
            if (isFormattedDbV2Data(parsedData)) {
              const dataId = await transaction.objectStore('data').add({
                ...parsedData,
                blobs: {},
              });

              const scrollX = oldValues.scrollX[key];
              if (scrollX) {
                await transaction.objectStore('bookmark').put({
                  dataId,
                  scrollX: +scrollX,
                });
              }

              if (oldValues.lastItem === key) {
                transaction.objectStore('lastItem').put({
                  dataId,
                }, 0);
              }
            }
          })
        );

        oldDbV2.deleteObjectStore('keyvaluepairs');
        oldDbV2.deleteObjectStore('local-forage-detect-blob-support');
        break;
      }
    }
  }
});

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  db = db;

}

interface DbV2Data {
  title: string;
  elementHtml: string;
  styleSheet: string;
}

function isFormattedDbV2Data(x: unknown): x is DbV2Data {
  if (typeof x === 'object' && x) {
    for (const key of ['title', 'elementHtml', 'styleSheet']) {
      // @ts-ignore
      if (!(key in x) || typeof x[key] !== 'string') {
        return false;
      }
    }
    return true;
  }
  return false;
}
