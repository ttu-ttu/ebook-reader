/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import {
  animationFrameScheduler,
  BehaviorSubject,
  EMPTY,
  filter,
  interval,
  map,
  pairwise,
  switchMap,
  takeUntil,
  type Observable,
  type SchedulerLike
} from 'rxjs';
import type { AutoScroller } from '../types';

export class AutoScrollerContinuous implements AutoScroller {
  private enabled$ = new BehaviorSubject<boolean>(false);

  constructor(
    public multiplier: number,
    public verticalMode: boolean,
    destroy$: Observable<void>,
    document: Document,
    scheduler: SchedulerLike = animationFrameScheduler
  ) {
    this.enabled$
      .pipe(
        switchMap((b) => {
          if (!b) {
            return EMPTY;
          }

          let acc = 0;
          return interval(0, scheduler).pipe(
            map(() => Date.now()),
            pairwise(),
            map((x) => this.calcNewPos(x)),
            map((x) => {
              acc += x;
              const intX = Math.trunc(acc);
              acc -= intX;
              return intX;
            }),
            filter((x) => x !== 0)
          );
        }),
        takeUntil(destroy$)
      )
      .subscribe((scrollVal) => {
        let scrollDirection: 'left' | 'top' = 'top';

        if (verticalMode) {
          scrollDirection = 'left';
        }
        document.documentElement.scrollBy({
          [scrollDirection]: scrollVal
        });
      });
  }

  toggle() {
    this.enabled$.next(!this.enabled$.getValue());
  }

  private calcNewPos([prevTick, curTick]: [number, number]) {
    let scrollScale = 0.00365956;

    if (this.verticalMode) {
      scrollScale = -0.00091489;
    }
    return scrollScale * this.multiplier * (curTick - prevTick);
  }
}
