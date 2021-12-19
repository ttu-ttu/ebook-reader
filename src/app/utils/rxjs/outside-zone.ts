/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { NgZone } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export default function outsideZone<T>(zone: NgZone) {
  return (source: Observable<T>) =>
    new Observable<T>((observer) => {
      let sub: Subscription;
      zone.runOutsideAngular(() => {
        sub = source.subscribe(observer);
      });

      return sub!;
    });
}
