/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

// https://stackoverflow.com/a/47206289
export function SmoothScroll(target: HTMLElement, smooth: number) {
  const scrollAxis = 'scrollLeft';

  let moving = false;
  let targetPos = target[scrollAxis];
  let expectedPos = target[scrollAxis];

  function update() {
    moving = true;

    const delta = Math.trunc((targetPos - target[scrollAxis]) / smooth);

    if (target[scrollAxis] !== expectedPos) {
      moving = false;
    } else {
      expectedPos += delta;
      target.scrollBy(delta, 0);

      if (Math.abs(delta) > 0) {
        window.requestAnimationFrame(update);
      } else {
        moving = false;
      }
    }
  }

  return (delta: number) => {
    if (!moving) {
      targetPos = target[scrollAxis];
      expectedPos = target[scrollAxis];
    }

    targetPos += delta;

    if (!moving) {
      update();
    }
  };
}
