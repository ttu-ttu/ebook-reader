/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { formatPageTitle } from './format-page-title';

describe('formatPageTitle', () => {
  it('junta o título ao nome do app', () => {
    expect(formatPageTitle('Home')).toBe('Home | Dokusho');
  });

  it('sem título, devolve só o nome do app', () => {
    expect(formatPageTitle('')).toBe('Dokusho');
  });
});
