/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { map } from 'rxjs/operators';
import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
import formatBookDataHtml from './format-book-data-html';
import formatStyleSheet from './format-style-sheet';

export default function loadBookData(
  bookData: BooksDbBookData,
  parentSelector: string,
  document: Document
) {
  return formatBookDataHtml(bookData, document).pipe(
    map((htmlContent) => ({
      htmlContent,
      styleSheet: formatStyleSheet(bookData, parentSelector)
    }))
  );
}
