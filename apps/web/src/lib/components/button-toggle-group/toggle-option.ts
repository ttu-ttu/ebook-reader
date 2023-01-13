/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

export interface ToggleOption<T> {
  id: T;
  text: string;
  style?: Record<string, string>;
  thickBorders?: boolean;
}
