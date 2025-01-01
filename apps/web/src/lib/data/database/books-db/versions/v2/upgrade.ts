/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';

import type BooksDb from '../books-db';
import type { BooksDbBookData } from '../books-db';
import type BooksDbV2 from './books-db-v2';

export default async function upgradeBooksDbFromV2(
  oldDb: IDBPDatabase<BooksDb>,
  oldVersion: number,
  newVersion: number | null,
  transaction: IDBPTransaction<BooksDb, StoreNames<BooksDb>[], 'versionchange'>
) {
  const dataStore = oldDb.createObjectStore('data', {
    keyPath: 'id',
    autoIncrement: true
  });
  dataStore.createIndex('title', 'title');

  oldDb.createObjectStore('bookmark', {
    keyPath: 'dataId'
  });

  oldDb.createObjectStore('lastItem');

  const oldDbV2 = oldDb as unknown as IDBPDatabase<BooksDbV2>;
  const transactionV2 = transaction as unknown as IDBPTransaction<BooksDbV2>;

  const oldValues: {
    data: Record<string, string>;
    scrollX: Record<string, string>;
    lastItem?: string;
  } = {
    data: {},
    scrollX: {}
  };
  {
    let cursor = await transactionV2.objectStore('keyvaluepairs').openCursor();
    while (cursor) {
      const regexResult = /([^-]+)-(.+)/.exec(cursor.key);
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
        // Until https://github.com/jakearchibald/idb/issues/150 resolves
        const bookDataWithoutKey: Omit<BooksDbBookData, 'id'> = {
          ...parsedData,
          blobs: {},
          hasThumb: false,
          characters: 0,
          lastBookModified: 0,
          lastBookOpen: 0
        };
        const dataId = await transaction
          .objectStore('data')
          .add(bookDataWithoutKey as BooksDbBookData);

        const scrollX = oldValues.scrollX[key];
        if (scrollX) {
          await transaction.objectStore('bookmark').put({
            dataId,
            scrollX: +scrollX,
            progress: '0%',
            lastBookmarkModified: 0
          });
        }

        if (oldValues.lastItem === key) {
          transaction.objectStore('lastItem').put(
            {
              dataId
            },
            0
          );
        }
      }
    })
  );

  oldDbV2.deleteObjectStore('keyvaluepairs');
  oldDbV2.deleteObjectStore('local-forage-detect-blob-support');
}

interface DbV2Data {
  title: string;
  elementHtml: string;
  styleSheet: string;
}

function isFormattedDbV2Data(x: any): x is DbV2Data {
  if (typeof x === 'object' && x) {
    return ['title', 'elementHtml', 'styleSheet'].every(
      (key) => key in x && typeof x[key] === 'string'
    );
  }
  return false;
}
