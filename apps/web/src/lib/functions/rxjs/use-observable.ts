/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import type { Observable } from 'rxjs';

export function observe<T>(node: Node, obs: Observable<T>) {
  const subscription = obs.subscribe();

  return {
    destroy: () => subscription.unsubscribe()
  };
}
