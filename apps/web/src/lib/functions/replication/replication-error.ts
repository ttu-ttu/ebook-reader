/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

// eslint-disable-next-line max-classes-per-file
class AbortError extends Error {
  name = 'AbortError';
}

class ReplicationError extends Error {
  name = 'ReplicationError';

  isRecoverable = false;

  constructor(message: string, isRecoverable = true) {
    super(message);

    this.isRecoverable = isRecoverable;
  }
}

function throwIfAborted(cancelSignal?: AbortSignal) {
  if (!cancelSignal) {
    return;
  }

  if (typeof cancelSignal.throwIfAborted === 'function') {
    cancelSignal.throwIfAborted();
  } else if (cancelSignal.aborted) {
    throw new AbortError('User canceled');
  }
}

export { ReplicationError, throwIfAborted };
