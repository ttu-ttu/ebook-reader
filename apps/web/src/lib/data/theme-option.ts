/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { builtInThemes, resolveTheme, toReaderThemeOption } from '$lib/data/theme/themes';

/** Reader colours of a theme. Full app themes live in theme/themes.ts. */
export interface ThemeOption {
  fontColor: string;
  backgroundColor: string;
  selectionFontColor: string;
  selectionBackgroundColor: string;
  hintFuriganaShadowColor: string;
  hintFuriganaFontColor: string;
  tooltipTextFontColor: string;
}

export const availableThemes = new Map(
  builtInThemes.map((theme) => [theme.id, toReaderThemeOption(resolveTheme(theme.id, {}))])
);
