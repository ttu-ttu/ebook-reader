/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

describe('Book Manager Page', () => {
  beforeEach(() => {
    cy.visit('/manage');
  });

  it('Upload one book and auto load', () => {
    const bookPath = 'books/epubs/test.epub';
    cy.fixture(bookPath, 'binary')
      .then(Cypress.Blob.binaryStringToBlob)
      .then((fileContent) => {
        cy.get('[data-test-id="upload-book"]').attachFile({
          fileContent,
          filePath: bookPath,
          encoding: 'utf-8',
          lastModified: new Date().getTime(),
        });

        cy.url().should('not.include', '/manage');
        cy.get('h1').contains('Sample Book (test.epub)');
      });
  });

  it('Show error on upload failure', () => {
    const bookPath = 'books/epubs/corrupt.epub';
    cy.fixture(bookPath, 'binary')
      .then(Cypress.Blob.binaryStringToBlob)
      .then((fileContent) => {
        cy.get('[data-test-id="upload-book"]').attachFile({
          fileContent,
          filePath: bookPath,
          encoding: 'utf-8',
          lastModified: new Date().getTime(),
        });

        cy.contains('Failed to import');
      });
  });
});
