/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type BooksDb from './versions/books-db';
import { openDB } from 'idb';
import upgradeBooksDbFromV2 from './versions/v2/upgrade';

export function createBooksDb(name = 'books') {
  return openDB<BooksDb>(name, 7, {
    async upgrade(oldDb, oldVersion, newVersion, transaction) {
      if (oldVersion < 3 && oldVersion >= 2) {
        await upgradeBooksDbFromV2(oldDb, oldVersion, newVersion, transaction);
      }

      if (!oldDb.objectStoreNames.contains('data')) {
        const dataStore = oldDb.createObjectStore('data', {
          keyPath: 'id',
          autoIncrement: true
        });
        dataStore.createIndex('title', 'title');
      }

      if (!oldDb.objectStoreNames.contains('bookmark')) {
        oldDb.createObjectStore('bookmark', {
          keyPath: 'dataId'
        });
      }

      if (!oldDb.objectStoreNames.contains('userBookmark')) {
        const userBookmarkStore = oldDb.createObjectStore('userBookmark', {
          keyPath: 'id',
          autoIncrement: true
        });
        userBookmarkStore.createIndex('dataId', 'dataId');
      }

      if (!oldDb.objectStoreNames.contains('lastItem')) {
        oldDb.createObjectStore('lastItem');
      }

      if (!oldDb.objectStoreNames.contains('storageSource')) {
        oldDb.createObjectStore('storageSource', {
          keyPath: 'name'
        });
      }

      if (!oldDb.objectStoreNames.contains('statistic')) {
        const statisticsStore = oldDb.createObjectStore('statistic', {
          keyPath: ['title', 'dateKey']
        });

        statisticsStore.createIndex('dateKey', 'dateKey');
        statisticsStore.createIndex('completedBook', ['completedBook', 'title']);
      }

      if (!oldDb.objectStoreNames.contains('readingGoal')) {
        const readingGoalsStore = oldDb.createObjectStore('readingGoal', {
          keyPath: 'goalStartDate'
        });

        readingGoalsStore.createIndex('goalEndDate', 'goalEndDate');
      }

      if (!oldDb.objectStoreNames.contains('lastModified')) {
        oldDb.createObjectStore('lastModified', {
          keyPath: ['title', 'dataType']
        });
      }

      if (!oldDb.objectStoreNames.contains('audioBook')) {
        oldDb.createObjectStore('audioBook', { keyPath: 'title' });
      }

      if (!oldDb.objectStoreNames.contains('subtitle')) {
        oldDb.createObjectStore('subtitle', { keyPath: 'title' });
      }

      if (!oldDb.objectStoreNames.contains('handle')) {
        oldDb.createObjectStore('handle', { keyPath: ['title', 'dataType'] });
      }
    }
  });
}
