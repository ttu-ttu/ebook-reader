/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Token color values based on Anki card maturity
 */
export enum TokenColor {
  /** Mature card (interval >= threshold, default 21 days) - Green */
  MATURE = '#4caf50',
  /** Young/learning card (0 < interval < threshold) - Orange */
  YOUNG = '#ff9800',
  /** Unknown/new card (interval === 0) - Red */
  UNKNOWN = '#f44336',
  /** No card found in Anki - Default text color */
  UNCOLLECTED = '',
  /** Error occurred during lookup - Gray */
  ERROR = '#9e9e9e'
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
