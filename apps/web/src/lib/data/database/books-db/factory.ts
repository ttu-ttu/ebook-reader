/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import type BooksDb from './versions/books-db';
import { openDB } from 'idb';
import upgradeBooksDbFromV2 from './versions/v2/upgrade';

export function createBooksDb(name = 'books') {
  return openDB<BooksDb>(name, 6, {
    async upgrade(oldDb, oldVersion, newVersion, transaction) {
      switch (oldVersion) {
        case 0: {
          const dataStore = oldDb.createObjectStore('data', {
            keyPath: 'id',
            autoIncrement: true
          });
          dataStore.createIndex('title', 'title');

          oldDb.createObjectStore('bookmark', {
            keyPath: 'dataId'
          });

          oldDb.createObjectStore('lastItem');

          oldDb.createObjectStore('storageSource', {
            keyPath: 'name'
          });

          const statisticsStore = oldDb.createObjectStore('statistic', {
            keyPath: ['title', 'dateKey']
          });

          statisticsStore.createIndex('dateKey', 'dateKey');
          statisticsStore.createIndex('completedBook', ['completedBook', 'title']);

          const readingGoalsStore = oldDb.createObjectStore('readingGoal', {
            keyPath: 'goalStartDate'
          });

          readingGoalsStore.createIndex('goalEndDate', 'goalEndDate');

          oldDb.createObjectStore('lastModified', {
            keyPath: ['title', 'dataType']
          });

          oldDb.createObjectStore('audioBook', { keyPath: 'title' });

          oldDb.createObjectStore('subtitle', { keyPath: 'title' });

          oldDb.createObjectStore('handle', { keyPath: ['title', 'dataType'] });

          break;
        }
        case 2: {
          await upgradeBooksDbFromV2(oldDb, oldVersion, newVersion, transaction);
          break;
        }
        case 3: {
          oldDb.createObjectStore('storageSource', {
            keyPath: 'name'
          });
          break;
        }
        case 4: {
          const statisticsStore = oldDb.createObjectStore('statistic', {
            keyPath: ['title', 'dateKey']
          });

          statisticsStore.createIndex('dateKey', 'dateKey');
          statisticsStore.createIndex('completedBook', ['completedBook', 'title']);

          const readingGoalsStore = oldDb.createObjectStore('readingGoal', {
            keyPath: 'goalStartDate'
          });

          readingGoalsStore.createIndex('goalEndDate', 'goalEndDate');

          oldDb.createObjectStore('lastModified', {
            keyPath: ['title', 'dataType']
          });

          break;
        }
        case 5: {
          oldDb.createObjectStore('audioBook', { keyPath: 'title' });

          oldDb.createObjectStore('subtitle', { keyPath: 'title' });

          oldDb.createObjectStore('handle', { keyPath: ['title', 'dataType'] });

          break;
        }
      }
    }
  });
}
