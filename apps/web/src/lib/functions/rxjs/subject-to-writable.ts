/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { Subject } from 'rxjs';

/* eslint-disable no-param-reassign */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function subjectToSvelteWritable<S extends Subject<any>>(subject: S) {
  // @ts-expect-error Svelte uses `set` like `next`
  subject.set = subject.next;
  return subject;
}
