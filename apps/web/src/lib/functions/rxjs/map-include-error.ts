/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { catchError, map, of, pipe } from 'rxjs';

export function mapIncludeError<T>() {
  return pipe(
    map<T, [0, T]>((x) => [0, x]),
    catchError((err: unknown) => of([err] as [unknown]))
  );
}
