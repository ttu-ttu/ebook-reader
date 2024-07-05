/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export function match(param: string): boolean {
  return /^\d+$/.test(param);
}
