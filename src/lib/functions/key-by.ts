/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export function keyBy<T, K extends keyof T>(array: T[], key: K): Map<T[K], T> {
  return new Map(array.map((item) => [item[key], item]));
}
