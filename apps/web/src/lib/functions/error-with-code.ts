/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

export class ErrorWithCode<T = number> extends Error {
  constructor(message: string, public code: T) {
    super(message);
  }
}
