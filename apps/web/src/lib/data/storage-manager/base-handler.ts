/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
import type { LoadData } from '$lib/functions/file-loaders/types';

export abstract class BaseStorageHandler {
  abstract init(window: Window): void;

  abstract getDataList(): Promise<BookCardProps[]>;

  abstract addBook(book: LoadData): Promise<number>;

  abstract applyUpsert(book: BooksDbBookData): void;

  abstract deleteBookData(booksToDelete: string[], cancelSignal: AbortSignal): Promise<any[]>;

  protected window: Window;

  protected dataListFetched = false;

  constructor(window: Window) {
    this.window = window;
  }
}
