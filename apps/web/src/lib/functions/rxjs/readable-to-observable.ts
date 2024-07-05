/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { Observable } from 'rxjs';
import type { Readable } from 'svelte/store';

export function readableToObservable<T>(readable: Readable<T>): Observable<T> {
  return new Observable<T>((subscriber) =>
    readable.subscribe((x) => {
      subscriber.next(x);
    })
  );
}
