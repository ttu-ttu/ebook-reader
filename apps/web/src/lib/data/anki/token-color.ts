/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Token color values based on Anki card retrievability
 */
export enum TokenColor {
  /** High retrievability (>90%) - Green */
  MATURE = '#16a34a',
  /** Good retrievability (>80%) - Yellow */
  YOUNG = '#ca8a04',
  /** Medium retrievability (>=60%) - Orange */
  NEW = '#ea580c',
  /** Low retrievability (<60%) - Red */
  LOW = '#dc2626',
  /** Known card but status could not be resolved - inherit current text color */
  UNKNOWN = 'currentColor',
  /** Not mined (no matching card found) - Purple */
  UNCOLLECTED = '#c355ff',
  /** Error occurred during lookup - Gray */
  ERROR = '#9ca3af'
}

export type WordStatus = 'mature' | 'young' | 'new' | 'low' | 'unknown';
export type ResolvedWordStatus = Exclude<WordStatus, 'unknown'>;

export enum TokenColorPalette {
  FULL = 'full',
  SIMPLE = 'simple'
}

/**
 * Token styling options
 */
export enum TokenStyle {
  /** Color the text itself */
  TEXT = 'text',
  /** Underline with colored line */
  UNDERLINE = 'underline'
}
