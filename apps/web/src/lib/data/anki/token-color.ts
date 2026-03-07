/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Token color values for Anki-derived token states.
 */
export enum TokenColor {
  /** Best state bucket */
  MATURE = '#16a34a',
  /** Secondary state bucket */
  YOUNG = '#ca8a04',
  /** Tertiary state bucket */
  NEW = '#ea580c',
  /** Lowest state bucket */
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

export enum TokenColorMode {
  STABILITY = 'stability',
  RETRIEVABILITY = 'retrievability',
  COMBINED = 'combined'
}

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
