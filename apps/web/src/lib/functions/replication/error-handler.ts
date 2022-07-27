/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { LimitFunction } from 'p-limit';
import { logger } from '$lib/data/logger';
import { replicationProgress$ } from '$lib/functions/replication/replication-progress';

export function handleErrorDuringReplication(
  error: any,
  baseError = '',
  limiters?: LimitFunction[]
) {
  if (error.name !== 'AbortError') {
    logger.error(`${baseError}${error.message}`);
  }

  if (error.name === 'AbortError' || (error.name === 'ReplicationError' && !error.isRecoverable)) {
    if (limiters) {
      for (let index = 0, { length } = limiters; index < length; index += 1) {
        limiters[index].clearQueue();
      }
    }

    throw error;
  }

  replicationProgress$.next({ progressToAdd: -1 });

  return `${baseError}${error.message}`;
}
