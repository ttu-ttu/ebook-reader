/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { InjectionToken } from '@angular/core';
import { IDBPDatabase } from 'idb';
import BooksDb from './versions/books-db';

const BOOKS_DB_PROMISE = new InjectionToken<Promise<IDBPDatabase<BooksDb>>>(
  'BOOKS_DB_PROMISE'
);

export default BOOKS_DB_PROMISE;
