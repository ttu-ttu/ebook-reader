/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

describe('Root Path Redirect', () => {
  before(() => {
    cy.visit('/');
  });

  it('Redirects to manager when no books', () => {
    cy.url().should('include', '/manage');
  });
});

describe('Dead Path Redirect', () => {
  it('Redirects to manager', () => {
    cy.visit('/some-unknown-path');
    cy.url().should('include', '/manage');
  });
});
