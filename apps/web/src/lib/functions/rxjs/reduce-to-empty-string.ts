/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { filter, map, pipe } from 'rxjs';

export function reduceToEmptyString() {
  return pipe(
    map((): '' => ''),
    filter((_, index) => !index)
  );
}
