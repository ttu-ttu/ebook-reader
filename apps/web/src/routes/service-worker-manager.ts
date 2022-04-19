/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { Subject } from 'rxjs';
import { browser, dev } from '$app/env';

export const swUpdateReady$ = new Subject<void>();

if (browser && !dev && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => swUpdateReady$.next());
}
