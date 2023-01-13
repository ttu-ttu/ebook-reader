/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

export function cloneMutateSet<T>(set: ReadonlySet<T>, action: (set: Set<T>) => void) {
  const result = new Set(set);
  action(result);
  return result;
}
