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
  MATURE = '#71ff34',
  /** Young/learning card (0 < interval < threshold) - Orange */
  YOUNG = '#ffbe3b',
  /** Unknown/new card (interval === 0) - Red */
  UNKNOWN = '#ff7878',
  /** No card found in Anki - Default text color */
  UNCOLLECTED = '#ffffff',
  /** Error occurred during lookup - Gray */
  ERROR = '#c355ff'
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
