/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import type { Subject } from 'rxjs';

export function subjectToSvelteWritable<S extends Subject<any>>(subject: S) {
  // @ts-expect-error Svelte uses `set` like `next`
  subject.set = subject.next;
  return subject;
}
