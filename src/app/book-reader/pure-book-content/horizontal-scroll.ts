/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

const enum DeltaMode {
  DeltaPixel = 0,
  DeltaLine = 1,
  DeltaPage = 2,
}

export default class HorizontalMouseWheelMimic {
  private wheelEventFn: (delta: number) => void;

  constructor(private window: Window, target: HTMLElement, smooth: number) {
    this.wheelEventFn = SmoothScroll(target, smooth);
  }

  onWheel(ev: WheelEvent, fontSize: number) {
    if (
      !ev.deltaY ||
      ev.deltaX ||
      ev.altKey ||
      ev.shiftKey ||
      ev.ctrlKey ||
      ev.metaKey
    ) {
      return;
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
    let scrollDistance: number;
    switch (ev.deltaMode) {
      case DeltaMode.DeltaPixel:
        scrollDistance = ev.deltaY;
        break;
      case DeltaMode.DeltaLine:
        scrollDistance = ev.deltaY * fontSize * 1.75;
        break;
      default:
        scrollDistance = ev.deltaY * this.window.innerWidth;
    }

    this.wheelEventFn(-scrollDistance);
    ev.preventDefault();
  }
}

// https://stackoverflow.com/a/47206289
function SmoothScroll(target: HTMLElement, smooth: number) {
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
        requestAnimationFrame(update);
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
      requestAnimationFrame(update);
    }
  };
}
