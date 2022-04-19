/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

export const visualViewport: VisualViewport =
  typeof window !== 'undefined'
    ? window.visualViewport
    : ({
        addEventListener: () => 0,
        removeEventListener: () => 0
      } as any);
