/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import 'cypress-file-upload';
import { CypressAll } from './utils/cypress-all';
import { BooksDbBookData, databaseManager } from './utils/db';

declare global {
  namespace Cypress {
    interface Chainable {
      getBookData: (bookId: number) => Chainable<BooksDbBookData>;

      loadTestEpubToDb: () => Chainable<number>;
    }
  }
}

Cypress.Commands.add('getBookData', (bookId) =>
  cy.then(async () => {
    const db = await databaseManager.openDb();
    const book = await db.get('data', bookId);

    if (!book) {
      throw new Error(`Book with id "${bookId}" not found`);
    }
    return book;
  })
);

async function postBookToDb(bookData: Omit<BooksDbBookData, 'id'>) {
  const db = await databaseManager.openDb();
  return db.add('data', bookData as BooksDbBookData);
}

Cypress.Commands.add('loadTestEpubToDb', () =>
  CypressAll([
    () => cy.fixture('db/test-epub/index.html'),
    () => cy.fixture('books/epubs/test/cover.jpg'),
  ]).then(([elementHtml, cover]) => {
    const coverBlob = Cypress.Blob.base64StringToBlob(cover);
    return postBookToDb({
      title: 'Test Book (test.epub)',
      elementHtml,
      styleSheet: '',
      blobs: {
        'cover.jpg': coverBlob,
      },
      coverImage: coverBlob,
      hasThumb: true,
    });
  })
);
