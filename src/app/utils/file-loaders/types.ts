/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { BooksDbBookData } from 'src/app/database/books-db/versions/books-db';

export interface LoadData extends Omit<BooksDbBookData, 'id'> {
  coverImage: Blob | undefined;
}
