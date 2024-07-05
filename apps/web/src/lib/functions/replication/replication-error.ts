/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export class AbortError extends Error {
  name = 'AbortError';
}

export function throwIfAborted(cancelSignal?: AbortSignal) {
  if (!cancelSignal) {
    return;
  }

  if (typeof cancelSignal.throwIfAborted === 'function') {
    cancelSignal.throwIfAborted();
  } else if (cancelSignal.aborted) {
    throw new AbortError('User canceled');
  }
}
