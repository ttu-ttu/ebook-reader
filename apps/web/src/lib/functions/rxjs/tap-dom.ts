/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { animationFrameScheduler, finalize, Observable, observeOn } from 'rxjs';

export function tapDom<T, A>(
  getItem: () => T,
  nextFn: (value: A, item: T) => void,
  completeFn: (item: T) => void
) {
  return (obs: Observable<A>) =>
    new Observable<A>((subscriber) => {
      const item = getItem();
      return obs
        .pipe(
          observeOn(animationFrameScheduler),
          finalize(() => completeFn(item))
        )
        .subscribe({
          next: (x) => {
            nextFn(x, item);
            subscriber.next(x);
          },
          error: (x: unknown) => subscriber.error(x),
          complete: () => subscriber.complete()
        });
    });
}
