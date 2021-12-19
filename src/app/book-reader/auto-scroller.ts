/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import { Injector } from '@angular/core';
import {
  animationFrameScheduler,
  BehaviorSubject,
  EMPTY,
  filter,
  interval,
  map,
  pairwise,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { StoreService } from 'src/app/store.service';

export class AutoScroller {
  private enabled$ = new BehaviorSubject<boolean>(false);

  private store: StoreService;

  constructor(injector: Injector, destroy$: Subject<void>) {
    this.store = injector.get(StoreService);
    const document = injector.get(DOCUMENT);

    this.enabled$
      .pipe(
        switchMap((b) => {
          if (!b) {
            return EMPTY;
          }

          let acc = 0;
          return interval(0, animationFrameScheduler).pipe(
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

        if (this.store.isVerticalMode()) {
          scrollDirection = 'left';
        }
        document.documentElement.scrollBy({
          [scrollDirection]: scrollVal,
        });
      });
  }

  private calcNewPos([prevTick, curTick]: [number, number]) {
    const multiplier = this.store.multiplier$.getValue();

    let scrollScale = 0.00365956;

    if (this.store.isVerticalMode()) {
      scrollScale = -0.00091489;
    }
    return scrollScale * multiplier * (curTick - prevTick);
  }

  toggle() {
    this.enabled$.next(!this.enabled$.getValue());
  }

  increaseSpeedSafe() {
    if (!this.enabled$.getValue()) {
      return;
    }
    this.store.multiplier$.next(this.store.multiplier$.getValue() + 1);
  }

  decreaseSpeedSafe() {
    this.store.multiplier$.next(this.store.multiplier$.getValue() - 1);
  }
}
