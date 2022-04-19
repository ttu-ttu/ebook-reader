/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { pipe, scan } from 'rxjs';

export function scanCombine<T>() {
  return pipe(
    scan<T, T[]>((acc, cur) => {
      acc.push(cur);
      return acc;
    }, [])
  );
}
