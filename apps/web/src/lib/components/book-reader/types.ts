/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';

export interface AutoScroller {
  toggle: () => void;
  off: () => void;
}

export interface BookmarkManager {
  formatBookmarkData: (bookId: number) => BooksDbBookmarkData;

  scrollToBookmark: (bookmarkData: BooksDbBookmarkData) => void;
}

export interface PageManager {
  nextPage: () => void;

  prevPage: () => void;
}
