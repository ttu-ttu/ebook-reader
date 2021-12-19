/* eslint-disable header/header */
// https://github.com/cypress-io/cypress/issues/915#issuecomment-587999697

export type CypressFn<T> = () => Cypress.Chainable<T>;

export function CypressAll<T1, T2, T3, T4, T5, T6>(
  fns: [
    CypressFn<T1>,
    CypressFn<T2>,
    CypressFn<T3>,
    CypressFn<T4>,
    CypressFn<T5>,
    CypressFn<T6>
  ]
): Cypress.Chainable<[T1, T2, T3, T4, T5, T6]>;
export function CypressAll<T1, T2, T3, T4, T5>(
  fns: [
    CypressFn<T1>,
    CypressFn<T2>,
    CypressFn<T3>,
    CypressFn<T4>,
    CypressFn<T5>
  ]
): Cypress.Chainable<[T1, T2, T3, T4, T5]>;
export function CypressAll<T1, T2, T3, T4>(
  fns: [CypressFn<T1>, CypressFn<T2>, CypressFn<T3>, CypressFn<T4>]
): Cypress.Chainable<[T1, T2, T3, T4]>;
export function CypressAll<T1, T2, T3>(
  fns: [CypressFn<T1>, CypressFn<T2>, CypressFn<T3>]
): Cypress.Chainable<[T1, T2, T3]>;
export function CypressAll<T1, T2>(
  fns: [CypressFn<T1>, CypressFn<T2>]
): Cypress.Chainable<[T1, T2]>;
export function CypressAll<T1>(fns: [CypressFn<T1>]): Cypress.Chainable<[T1]>;
export function CypressAll<T>(fns: CypressFn<T>[]): Cypress.Chainable<T[]> {
  const results: T[] = [];

  fns.forEach((fn) => {
    fn().then((result) => results.push(result));
  });

  return cy.wrap(results);
}
