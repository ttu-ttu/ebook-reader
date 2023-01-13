/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type BooksDbV4 from '$lib/data/database/books-db/versions/v4/books-db-v4';

type BooksDb = BooksDbV4;

export type BooksDbBookData = BooksDb['data']['value'];
export type BooksDbBookmarkData = BooksDb['bookmark']['value'];
export type BooksDbStorageSource = BooksDb['storageSource']['value'];
export const currentDbVersion = 4;

export default BooksDb;
