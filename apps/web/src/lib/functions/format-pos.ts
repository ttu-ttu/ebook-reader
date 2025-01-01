/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

export function formatPos(position: number, direction: 'ltr' | 'rtl'): number {
  return direction === 'rtl' ? -position : position;
}
