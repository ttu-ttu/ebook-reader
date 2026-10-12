/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

const pressMs = 500;
const moveTolerancePx = 10;

/**
 * Svelte action: calls `listener` when the element is held down (or
 * right-clicked), and swallows the click that follows the press. Not part of upstream.
 */
export function longPress(node: HTMLElement, listener: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let startY = 0;
  let pressed = false;

  const cancel = () => clearTimeout(timer);
  const fire = () => {
    pressed = true;
    listener();
  };
  const onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0) {
      return;
    }
    pressed = false;
    startX = ev.clientX;
    startY = ev.clientY;
    cancel();
    timer = setTimeout(fire, pressMs);
  };
  const onPointerMove = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > moveTolerancePx) {
      cancel();
    }
  };
  // Touch browsers send contextmenu on a long press too; `listener` must be safe to call twice.
  const onContextMenu = (ev: MouseEvent) => {
    ev.preventDefault();
    cancel();
    fire();
  };
  const onClick = (ev: MouseEvent) => {
    if (pressed) {
      pressed = false;
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  };

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('contextmenu', onContextMenu);
  node.addEventListener('click', onClick, true);

  return {
    update(newListener: () => void) {
      listener = newListener;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('contextmenu', onContextMenu);
      node.removeEventListener('click', onClick, true);
    }
  };
}
