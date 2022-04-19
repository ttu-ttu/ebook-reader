/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { NEVER, type Observable } from 'rxjs';
import { browser as browserImpl } from '$app/env';

export function iffBrowser<T>(getObs: () => Observable<T>, browser = browserImpl) {
  return browser ? getObs() : NEVER;
}
