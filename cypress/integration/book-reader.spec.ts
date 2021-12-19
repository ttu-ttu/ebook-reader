/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

describe('Book Reader Page', () => {
  beforeEach(() => {
    cy.loadTestEpubToDb().then((bookId) => cy.visit(`/b/${bookId}`));
  });

  it('loads book', () => {
    cy.get('h1').contains('Sample Book (test.epub)');
  });
});
