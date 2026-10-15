/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Subscription, debounceTime, fromEvent, merge, tap } from 'rxjs';

export function multiClickHandler(node: Node, handler: { (): void }[]) {
  const [singleClickListener, doubleClickListener] = handler;

  let sub: Subscription | undefined;
  let clicked = 0;

  if (singleClickListener) {
    const clickEvent = fromEvent<MouseEvent>(node, 'click');
    const dblClickEvent = fromEvent<MouseEvent>(node, 'dblclick');
    const eventsMerged = merge(clickEvent, dblClickEvent).pipe(
      tap((event) => {
        event.stopPropagation();
        clicked += 1;
      }),
      debounceTime(200)
    );

    sub = eventsMerged.subscribe((event) => {
      if (event.type === 'click' && clicked < 2) {
        clicked = 0;
        singleClickListener();
        return;
      }

      clicked = 0;

      doubleClickListener();
    });
  }

  return {
    destroy() {
      sub?.unsubscribe();
    }
  };
}
