/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { browser as browserImpl } from '$app/environment';
import { NEVER, type Observable } from 'rxjs';

export function takeWhenBrowser<T>(browser = browserImpl) {
  return (obs: Observable<T>) => (browser ? obs : NEVER);
}
