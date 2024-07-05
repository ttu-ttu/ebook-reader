/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';

export interface LoadData extends Omit<BooksDbBookData, 'id'> {
  coverImage: Blob | undefined;
}
