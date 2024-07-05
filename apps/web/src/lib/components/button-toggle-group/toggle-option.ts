/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export interface ToggleOption<T> {
  id: T;
  text: string;
  style?: Record<string, string>;
  thickBorders?: boolean;
  showIcons?: boolean;
}

export const optionsForToggle: ToggleOption<boolean>[] = [
  {
    id: false,
    text: 'Off'
  },
  {
    id: true,
    text: 'On'
  }
];
