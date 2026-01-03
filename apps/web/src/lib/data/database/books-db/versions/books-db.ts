/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type BooksDbV6 from '$lib/data/database/books-db/versions/v6/books-db-v6';

type BooksDb = BooksDbV6;

export type BooksDbBookData = BooksDb['data']['value'];
export type BooksDbBookmarkData = BooksDb['bookmark']['value'];
export type BooksDbStorageSource = BooksDb['storageSource']['value'];
export type BooksDbStatistic = BooksDb['statistic']['value'];
export type BooksDbReadingGoal = BooksDb['readingGoal']['value'];
export type BooksDbLastModified = BooksDb['lastModified']['value'];
export type BooksDbAudioBook = BooksDb['audioBook']['value'];
export type BooksDbSubtitleData = BooksDb['subtitle']['value'];
export type BooksDbHandle = BooksDb['handle']['value'];
export const currentDbVersion = 6;

export default BooksDb;
