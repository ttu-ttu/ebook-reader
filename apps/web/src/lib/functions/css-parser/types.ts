/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

export interface CssTree {
  type: 'stylesheet';
  stylesheet: Stylesheet;
}

export interface Stylesheet {
  rules: Rule[];
}

export interface Rule {
  type: 'page' | 'rule';
  selectors: string[];
  declarations: Declaration[];
}

export interface Declaration {
  type: 'declaration';
  property: string;
  value: string;
}
