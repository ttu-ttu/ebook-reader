/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from '@angular/core';

const autoScrollMultiplierKey = 'autoScrollMultiplier';

@Injectable({
  providedIn: 'root'
})
export class AutoScrollerService {

  activated = false;
  multiplier: number;

  constructor() {
    const storedMultiplier = localStorage.getItem(autoScrollMultiplierKey);
    if (storedMultiplier) {
      this.multiplier = +storedMultiplier;
    } else {
      this.multiplier = 20;
    }
  }

  increaseSpeed() {
    this.multiplier += 1;
    localStorage.setItem(autoScrollMultiplierKey, `${this.multiplier}`);
  }

  decreaseSpeed() {
    this.multiplier = Math.max(1, this.multiplier - 1);
    localStorage.setItem(autoScrollMultiplierKey, `${this.multiplier}`);
  }

  stop() {
    this.activated = false;
  }

  toggle() {
    this.activated = !this.activated;

    if (this.activated) {
      this.autoScrollTick(Date.now(), document.documentElement.scrollLeft);
    }
  }

  private autoScrollTick(previousTick: number, expectedPos: number) {
    const currentTick = Date.now();
    const pixelsPerMs = -0.00091489 * this.multiplier;

    let calculatedCurrentPos: number;
    if (Math.abs(expectedPos - document.documentElement.scrollLeft) < 1) {
      calculatedCurrentPos = expectedPos;
    } else {
      // scrollLeft interrupted by something else
      calculatedCurrentPos = document.documentElement.scrollLeft;
    }
    const newExpectedPos = calculatedCurrentPos + (pixelsPerMs * (currentTick - previousTick));

    document.documentElement.scrollBy(newExpectedPos - document.documentElement.scrollLeft, 0);

    if (this.activated) {
      window.requestAnimationFrame(() => {
        this.autoScrollTick(currentTick, newExpectedPos);
      });
    }
  }
}
