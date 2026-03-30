/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { browser as browserImpl } from '$app/environment';
import { NEVER, type Observable } from 'rxjs';

export function iffBrowser<T>(getObs: () => Observable<T>, browser = browserImpl) {
  return browser ? getObs() : NEVER;
}
