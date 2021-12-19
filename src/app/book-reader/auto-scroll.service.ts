/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Injectable, Injector } from '@angular/core';
import { Subject } from 'rxjs';
import { AutoScroller } from './auto-scroller';

@Injectable({
  providedIn: 'root',
})
export class AutoScrollService {
  constructor(private injector: Injector) {}

  createAutoScroller(destroy$: Subject<void>) {
    return new AutoScroller(this.injector, destroy$);
  }
}
