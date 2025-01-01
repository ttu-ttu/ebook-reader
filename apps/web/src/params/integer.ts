/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

export function match(param: string): boolean {
  return /^\d+$/.test(param);
}
