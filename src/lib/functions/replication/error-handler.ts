/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { LimitFunction } from 'p-limit';
import { logger } from '$lib/data/logger';
import { replicationProgress$ } from '$lib/functions/replication/replication-progress';

export function handleErrorDuringReplication(
  error: any,
  baseError = '',
  limiters?: LimitFunction[],
  currentProgressBase?: number
) {
  if (error.name !== 'AbortError') {
    logger.error(`${baseError}${error.message}`);
  }

  if (error.name === 'AbortError') {
    if (limiters) {
      for (let index = 0, { length } = limiters; index < length; index += 1) {
        limiters[index].clearQueue();
      }
    }

    throw error;
  }

  if (currentProgressBase !== undefined) {
    replicationProgress$.next({ progressBase: currentProgressBase, skipStep: true });
  } else {
    replicationProgress$.next({ skipStep: true });
  }

  return `${baseError}${error.message}`;
}

export async function convertAuthErrorResponse(
  response: Response | XMLHttpRequest
): Promise<string> {
  const isXHR = response instanceof XMLHttpRequest;

  let error = `Received Status ${response.status} `;

  try {
    const headers = isXHR
      ? response.getResponseHeader('Content-Type')
      : response.headers.get('Content-Type');

    if (headers?.includes('application/json')) {
      const jsonResponse = isXHR ? response.response : await response.json();

      error =
        jsonResponse.error_description ||
        jsonResponse.error?.message ||
        jsonResponse.error ||
        error;
    } else {
      error = isXHR ? response.responseText : await response.text();
    }
  } catch (_) {
    // no-op
  }

  return error;
}
