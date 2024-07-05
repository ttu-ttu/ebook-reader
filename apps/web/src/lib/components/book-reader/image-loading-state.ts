/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { combineLatest, fromEvent, Observable, of, race } from 'rxjs';

export function imageLoadingState(contentEl: HTMLElement) {
  const elements = Array.from(contentEl.getElementsByTagName('img'));
  return new Observable<boolean>((subscriber) => {
    const obsArray = elements.filter((el) => el.src).map(imageLoadComplete);

    if (obsArray.length <= 0) {
      subscriber.next(false);
      subscriber.complete();
      return undefined;
    }

    const subscription = combineLatest(obsArray).subscribe(() => {
      subscriber.next(false);
      subscriber.complete();
    });
    subscriber.next(true);

    return subscription;
  });
}

function imageLoadComplete(imgEl: HTMLImageElement) {
  if (imgEl.complete) {
    return of(1);
  }
  return race(fromEvent(imgEl, 'load'), fromEvent(imgEl, 'error'));
}
