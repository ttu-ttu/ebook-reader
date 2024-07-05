/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export function horizontalMouseWheel(
  smooth: number,
  target: HTMLElement,
  animationCb: typeof requestAnimationFrame
) {
  const scrollFn = buildSmoothScroll(target, animationCb)(smooth, 'scrollLeft');

  return (ev: WheelEvent, fontSize: number, innerWidth: number) => {
    if (!isVerticalScroll(ev)) {
      return;
    }

    const scrollDistance = getScrollDistance(ev, fontSize, innerWidth);
    scrollFn(-scrollDistance);
    ev.preventDefault();
  };
}

function isVerticalScroll(ev: WheelEvent) {
  return !(!ev.deltaY || ev.deltaX || ev.altKey || ev.shiftKey || ev.ctrlKey || ev.metaKey);
}

const enum DeltaMode {
  DeltaPixel = 0,
  DeltaLine = 1,
  DeltaPage = 2
}

function getScrollDistance(ev: WheelEvent, fontSize: number, innerWidth: number) {
  // https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
  switch (ev.deltaMode) {
    case DeltaMode.DeltaPixel:
      return ev.deltaY;
    case DeltaMode.DeltaLine:
      return ev.deltaY * fontSize * 1.75;
    default:
      return ev.deltaY * innerWidth;
  }
}

// https://stackoverflow.com/a/47206289
function buildSmoothScroll(target: HTMLElement, animationCb: typeof requestAnimationFrame) {
  return (smooth: number, scrollAxis: 'scrollLeft' | 'scrollTop') => {
    let moving = false;
    let targetPos = target[scrollAxis];
    let expectedPos = target[scrollAxis];

    const update = () => {
      moving = true;

      const delta = Math.trunc((targetPos - target[scrollAxis]) / smooth);

      if (target[scrollAxis] !== expectedPos) {
        moving = false;
        return;
      }

      expectedPos += delta;
      target.scrollBy(delta, 0);

      if (Math.abs(delta) > 0) {
        animationCb(update);
        return;
      }

      moving = false;
    };

    return (delta: number) => {
      if (!moving) {
        targetPos = target[scrollAxis];
        expectedPos = target[scrollAxis];
      }

      targetPos += delta;

      if (!moving) {
        animationCb(update);
      }
    };
  };
}
