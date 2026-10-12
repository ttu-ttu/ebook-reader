/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Themes for the whole app: library, settings, statistics and the reader.
 * A theme is a ThemeDefinition (JSON, see themes.md) that may extend another
 * theme and override any colour token. Not part of upstream; replaces the
 * reader-only colour themes of theme-option.ts.
 */

import type { ThemeOption } from '$lib/data/theme-option';
import type { ThemeColors, ThemeToken } from '$lib/data/theme/theme-tokens';
import { themeTokens } from '$lib/data/theme/theme-tokens';

export interface ThemeDefinition {
  /** Unique id, lowercase letters, digits and dashes */
  id: string;
  name: string;
  /** Theme (built-in or custom) to start from; 'light' and 'dark' are the plain bases */
  extends?: string;
  /** Whether this is a dark theme (native controls, scrollbars); inherited if omitted */
  dark?: boolean;
  colors?: Partial<ThemeColors>;
  /** Corner roundness, 1 = default, 0 = square */
  radius?: number;
  /** Blur behind the glass header and popovers, in px */
  blur?: number;
  /** Font for the app interface (not the book) */
  uiFont?: string;
  /** Extra CSS appended after the theme variables */
  customCss?: string;
}

export interface ResolvedTheme {
  id: string;
  name: string;
  dark: boolean;
  builtIn: boolean;
  colors: ThemeColors;
  radius: number;
  blur: number;
  uiFont: string;
  customCss: string;
}

export const themeFormatVersion = 1;

/**
 * Tokens added with the Washi redesign. Their defaults follow the colours every
 * theme already sets, so themes made before them still look like themselves.
 */
const derivedTokens = {
  subtleText: 'color-mix(in srgb, var(--app-muted-fg) 72%, transparent)',
  accentHover: 'color-mix(in srgb, var(--accent-color) 84%, var(--font-color))',
  focusRing: 'var(--accent-color)',
  toggleOn: 'var(--accent-color)',
  toggleOff: 'color-mix(in srgb, var(--font-color) 24%, transparent)',
  progressTrack: 'color-mix(in srgb, var(--font-color) 12%, transparent)',
  progressFill: 'var(--accent-color)',
  coverShadow: 'var(--shadow-color)',
  heatmapEmpty: 'color-mix(in srgb, var(--font-color) 7%, transparent)',
  heatmapLow: 'color-mix(in srgb, var(--accent-color) 28%, var(--background-color))',
  heatmapHigh: 'var(--accent-color)'
} as const;

/** Jiten's difficulty palette, readable on light and dark backgrounds. */
const jitenDifficulty = {
  difficulty1: '#15803d',
  difficulty2: '#22c55e',
  difficulty3: '#06b6d4',
  difficulty4: '#d97706',
  difficulty5: '#dc2626'
} as const;

const lightBase: ThemeColors = {
  ...derivedTokens,
  ...jitenDifficulty,
  success: '#15803d',
  warning: '#b45309',
  background: '#eef3f6',
  surface: 'rgba(255, 255, 255, 0.8)',
  surfaceStrong: 'rgba(255, 255, 255, 0.92)',
  text: '#152033',
  mutedText: 'rgba(15, 23, 42, 0.66)',
  border: 'rgba(148, 163, 184, 0.26)',
  shadow: 'rgba(15, 23, 42, 0.12)',
  insetHighlight: 'rgba(255, 255, 255, 0.72)',
  accent: '#0f766e',
  accentStrong: '#115e59',
  accentText: '#f8fafc',
  control: 'rgba(255, 255, 255, 0.88)',
  controlBorder: 'rgba(148, 163, 184, 0.38)',
  danger: '#dc2626',
  overlay: 'rgba(0, 0, 0, 0.32)',
  scrollbar: 'rgba(100, 116, 139, 0.55)',
  headerBackground: 'rgba(15, 23, 42, 0.78)',
  headerText: '#f8fafc',
  headerBorder: 'rgba(255, 255, 255, 0.1)',
  headerIcon: 'rgba(226, 232, 240, 0.86)',
  headerIconBackground: 'rgba(255, 255, 255, 0.06)',
  headerIconBorder: 'rgba(255, 255, 255, 0.12)',
  headerIconHover: 'rgba(255, 255, 255, 0.12)',
  readerText: 'rgba(0, 0, 0, 0.87)',
  readerBackground: '#ffffff',
  selectionText: 'rgba(245, 245, 245, 1)',
  selectionBackground: 'rgba(151, 151, 151, 1)',
  furiganaHintText: 'rgba(0, 0, 0, 0.33)',
  furiganaHintShadow: 'rgba(34, 34, 49, 0.3)',
  footerText: 'rgba(0, 0, 0, 0.6)',
  panelBackground: 'rgba(31, 41, 55, 0.96)',
  panelText: '#f9fafb',
  highlightYellow: 'rgba(250, 204, 21, 0.4)',
  highlightGreen: 'rgba(74, 222, 128, 0.38)',
  highlightBlue: 'rgba(96, 165, 250, 0.38)',
  highlightPink: 'rgba(244, 114, 182, 0.38)',
  searchMatch: 'rgba(249, 115, 22, 0.5)',
  readingLine: 'rgba(56, 189, 248, 0.32)'
};

const darkBase: ThemeColors = {
  ...derivedTokens,
  ...jitenDifficulty,
  success: '#4ade80',
  warning: '#fbbf24',
  background: '#16191c',
  surface: 'rgba(36, 40, 45, 0.82)',
  surfaceStrong: 'rgba(44, 49, 55, 0.96)',
  text: '#e5e7eb',
  mutedText: 'rgba(229, 231, 235, 0.62)',
  border: 'rgba(148, 163, 184, 0.18)',
  shadow: 'rgba(0, 0, 0, 0.45)',
  insetHighlight: 'rgba(255, 255, 255, 0.05)',
  accent: '#2dd4bf',
  accentStrong: '#5eead4',
  accentText: '#042f2e',
  control: 'rgba(36, 40, 45, 0.92)',
  controlBorder: 'rgba(148, 163, 184, 0.26)',
  danger: '#f87171',
  overlay: 'rgba(0, 0, 0, 0.55)',
  scrollbar: 'rgba(148, 163, 184, 0.4)',
  headerBackground: 'rgba(8, 10, 12, 0.8)',
  headerText: '#f8fafc',
  headerBorder: 'rgba(255, 255, 255, 0.08)',
  headerIcon: 'rgba(226, 232, 240, 0.82)',
  headerIconBackground: 'rgba(255, 255, 255, 0.05)',
  headerIconBorder: 'rgba(255, 255, 255, 0.1)',
  headerIconHover: 'rgba(255, 255, 255, 0.1)',
  readerText: 'rgba(255, 255, 255, 0.87)',
  readerBackground: '#23272a',
  selectionText: 'rgba(85, 90, 92, 0.6)',
  selectionBackground: 'rgba(212, 217, 220, 0.8)',
  furiganaHintText: 'rgba(255, 255, 255, 0.33)',
  furiganaHintShadow: 'rgba(240, 240, 241, 0.3)',
  footerText: 'rgba(255, 255, 255, 0.6)',
  panelBackground: 'rgba(17, 24, 39, 0.96)',
  panelText: '#f9fafb',
  highlightYellow: 'rgba(250, 204, 21, 0.3)',
  highlightGreen: 'rgba(74, 222, 128, 0.28)',
  highlightBlue: 'rgba(96, 165, 250, 0.3)',
  highlightPink: 'rgba(244, 114, 182, 0.3)',
  searchMatch: 'rgba(249, 115, 22, 0.45)',
  readingLine: 'rgba(56, 189, 248, 0.28)'
};

const defaults = { radius: 1, blur: 24, uiFont: '', customCss: '' };

/** The default themes (Settings → Themes, and the reset target). */
export const defaultLightThemeId = 'washi-theme';
export const defaultDarkThemeId = 'washi-dark-theme';

/** Built-in themes. Ids from light-theme to black-theme are upstream's reader themes. */
export const builtInThemes: ThemeDefinition[] = [
  {
    id: 'washi-theme',
    name: 'Washi',
    extends: 'light',
    radius: 0.6,
    blur: 0,
    colors: {
      background: '#f5f0e6',
      surface: '#fbf8f1',
      surfaceStrong: '#fffdf8',
      text: '#1f1b16',
      mutedText: '#5f574b',
      subtleText: '#857c6f',
      border: '#e2d9c8',
      shadow: 'rgba(60, 40, 20, 0.12)',
      insetHighlight: 'rgba(255, 255, 255, 0)',
      accent: '#b23a24',
      accentStrong: '#9a2f1c',
      accentHover: '#9a2f1c',
      accentText: '#fffaf2',
      focusRing: '#b23a24',
      control: '#fffdf8',
      controlBorder: '#cfc3ad',
      danger: '#a3192b',
      success: '#2f7a3e',
      warning: '#9a5b06',
      overlay: 'rgba(31, 27, 22, 0.4)',
      scrollbar: 'rgba(95, 87, 75, 0.45)',
      toggleOff: '#cfc3ad',
      progressTrack: '#e8dfcf',
      coverShadow: 'rgba(60, 40, 20, 0.24)',
      difficulty1: '#4f7a3a',
      difficulty2: '#7d9a3e',
      difficulty3: '#c08a1e',
      difficulty4: '#c4561f',
      difficulty5: '#a3201b',
      heatmapEmpty: '#ebe3d4',
      heatmapLow: '#ecc3b4',
      headerBackground: '#f5f0e6',
      headerText: '#1f1b16',
      headerBorder: '#e2d9c8',
      headerIcon: '#5f574b',
      headerIconBackground: 'transparent',
      headerIconBorder: 'transparent',
      headerIconHover: 'rgba(31, 27, 22, 0.06)',
      readerText: '#2a241d',
      readerBackground: '#f7f2e8',
      selectionText: '#fffaf2',
      selectionBackground: 'rgba(178, 58, 36, 0.78)',
      furiganaHintText: 'rgba(42, 36, 29, 0.35)',
      furiganaHintShadow: 'rgba(42, 36, 29, 0.3)',
      footerText: 'rgba(42, 36, 29, 0.6)',
      panelBackground: '#fffdf8',
      panelText: '#1f1b16'
    }
  },
  {
    id: 'washi-dark-theme',
    name: 'Sumi',
    extends: 'dark',
    radius: 0.6,
    blur: 0,
    colors: {
      background: '#1a1714',
      surface: '#24201b',
      surfaceStrong: '#2c2823',
      text: '#ece5d8',
      mutedText: '#a89f90',
      subtleText: '#857d70',
      border: '#3a342d',
      shadow: 'rgba(0, 0, 0, 0.5)',
      insetHighlight: 'rgba(255, 255, 255, 0)',
      accent: '#e8735a',
      accentStrong: '#f08b73',
      accentHover: '#f08b73',
      accentText: '#1a1714',
      focusRing: '#e8735a',
      control: '#211d19',
      controlBorder: '#4a433a',
      danger: '#ff8f85',
      success: '#8cc68c',
      warning: '#e3a949',
      overlay: 'rgba(0, 0, 0, 0.6)',
      scrollbar: 'rgba(168, 159, 144, 0.4)',
      toggleOff: '#4a433a',
      progressTrack: '#332e28',
      coverShadow: 'rgba(0, 0, 0, 0.6)',
      difficulty1: '#7fae5f',
      difficulty2: '#a9c25a',
      difficulty3: '#e0b04a',
      difficulty4: '#ef8a4c',
      difficulty5: '#f0675a',
      heatmapEmpty: '#2a2621',
      heatmapLow: '#5a3329',
      headerBackground: '#1a1714',
      headerText: '#ece5d8',
      headerBorder: '#3a342d',
      headerIcon: '#a89f90',
      headerIconBackground: 'transparent',
      headerIconBorder: 'transparent',
      headerIconHover: 'rgba(236, 229, 216, 0.08)',
      readerText: 'rgba(236, 229, 216, 0.88)',
      readerBackground: '#1c1915',
      selectionText: '#1a1714',
      selectionBackground: 'rgba(232, 115, 90, 0.82)',
      furiganaHintText: 'rgba(236, 229, 216, 0.3)',
      furiganaHintShadow: 'rgba(236, 229, 216, 0.25)',
      footerText: 'rgba(236, 229, 216, 0.55)',
      panelBackground: '#24201b',
      panelText: '#ece5d8'
    }
  },
  { id: 'light-theme', name: 'Light', dark: false },
  {
    id: 'ecru-theme',
    name: 'Ecru',
    extends: 'light',
    colors: {
      background: '#f2f0e4',
      readerBackground: '#f7f6eb',
      accent: '#8a6a2f',
      accentStrong: '#6f5321'
    }
  },
  {
    id: 'water-theme',
    name: 'Water',
    extends: 'light',
    colors: {
      background: '#e4eef5',
      readerBackground: '#dfecf4',
      accent: '#0369a1',
      accentStrong: '#075985'
    }
  },
  { id: 'gray-theme', name: 'Gray', dark: true },
  {
    id: 'dark-theme',
    name: 'Dark',
    extends: 'dark',
    colors: {
      background: '#0f0f10',
      surface: 'rgba(28, 28, 30, 0.85)',
      surfaceStrong: 'rgba(36, 36, 38, 0.96)',
      control: 'rgba(28, 28, 30, 0.92)',
      readerText: 'rgba(255, 255, 255, 0.6)',
      readerBackground: '#121212',
      furiganaHintText: 'rgba(255, 255, 255, 0.23)'
    }
  },
  {
    id: 'black-theme',
    name: 'Black',
    extends: 'dark',
    colors: {
      background: '#000000',
      surface: 'rgba(14, 14, 14, 0.9)',
      surfaceStrong: 'rgba(22, 22, 22, 0.98)',
      control: 'rgba(14, 14, 14, 0.95)',
      headerBackground: 'rgba(0, 0, 0, 0.85)',
      readerBackground: '#000000'
    }
  },
  {
    id: 'sepia-theme',
    name: 'Sepia',
    extends: 'light',
    colors: {
      background: '#efe6d2',
      surface: 'rgba(251, 246, 236, 0.82)',
      surfaceStrong: 'rgba(253, 250, 243, 0.94)',
      text: '#3e2f22',
      mutedText: 'rgba(62, 47, 34, 0.76)',
      border: 'rgba(139, 107, 72, 0.22)',
      accent: '#8b5e34',
      accentStrong: '#6d4826',
      headerBackground: 'rgba(52, 38, 26, 0.84)',
      readerText: '#5b4636',
      readerBackground: '#f4ecd8',
      footerText: 'rgba(91, 70, 54, 0.65)',
      selectionBackground: 'rgba(139, 94, 52, 0.75)'
    }
  },
  {
    id: 'sakura-theme',
    name: 'Sakura',
    extends: 'light',
    colors: {
      background: '#fdeef2',
      surface: 'rgba(255, 250, 252, 0.82)',
      surfaceStrong: 'rgba(255, 252, 253, 0.94)',
      text: '#3f2a33',
      mutedText: 'rgba(63, 42, 51, 0.76)',
      border: 'rgba(219, 39, 119, 0.14)',
      accent: '#cf2470',
      accentStrong: '#be185d',
      headerBackground: 'rgba(80, 28, 52, 0.82)',
      readerText: '#3f2a33',
      readerBackground: '#fff5f7',
      selectionBackground: 'rgba(219, 39, 119, 0.6)'
    }
  },
  {
    id: 'nord-theme',
    name: 'Nord',
    extends: 'dark',
    colors: {
      background: '#2e3440',
      surface: 'rgba(59, 66, 82, 0.82)',
      surfaceStrong: 'rgba(67, 76, 94, 0.96)',
      text: '#eceff4',
      mutedText: 'rgba(216, 222, 233, 0.8)',
      control: 'rgba(59, 66, 82, 0.92)',
      accent: '#88c0d0',
      accentStrong: '#8fbcbb',
      accentText: '#2e3440',
      headerBackground: 'rgba(36, 41, 51, 0.85)',
      readerText: '#d8dee9',
      readerBackground: '#2e3440',
      footerText: 'rgba(216, 222, 233, 0.55)',
      selectionText: '#2e3440',
      selectionBackground: 'rgba(136, 192, 208, 0.85)'
    }
  },
  {
    id: 'solarized-dark-theme',
    name: 'Solarized Dark',
    extends: 'dark',
    colors: {
      background: '#002b36',
      surface: 'rgba(7, 54, 66, 0.82)',
      surfaceStrong: 'rgba(7, 54, 66, 0.97)',
      text: '#eee8d5',
      mutedText: '#a9b5b5',
      control: 'rgba(7, 54, 66, 0.92)',
      accent: '#b58900',
      accentStrong: '#cb9b11',
      accentText: '#002b36',
      headerBackground: 'rgba(0, 30, 38, 0.86)',
      readerText: '#93a1a1',
      readerBackground: '#002b36',
      footerText: 'rgba(147, 161, 161, 0.7)',
      selectionText: '#002b36',
      selectionBackground: 'rgba(147, 161, 161, 0.85)'
    }
  }
];

export const builtInThemeIds = new Set(builtInThemes.map((theme) => theme.id));

const reservedIds = new Set(['light', 'dark', ...builtInThemeIds]);

/**
 * Full colours of a theme: walks the `extends` chain down to the light or dark
 * base and applies each level's overrides. Unknown ids fall back to the first
 * built-in theme, and a cycle (possible in imported themes) stops at a base.
 */
export function resolveTheme(
  id: string,
  customThemes: Record<string, ThemeDefinition>,
  seen = new Set<string>()
): ResolvedTheme {
  if (id === 'light' || id === 'dark' || seen.has(id)) {
    const dark = id === 'dark';
    return {
      id,
      name: dark ? 'Dark base' : 'Light base',
      dark,
      builtIn: true,
      colors: { ...(dark ? darkBase : lightBase) },
      ...defaults
    };
  }

  const definition =
    builtInThemes.find((theme) => theme.id === id) || customThemes[id] || builtInThemes[0];
  const parentId = definition.extends || (definition.dark ? 'dark' : 'light');
  const parent = resolveTheme(parentId, customThemes, new Set([...seen, definition.id]));
  const colors = { ...parent.colors };

  Object.entries(definition.colors || {}).forEach(([token, value]) => {
    if (token in colors && typeof value === 'string' && value.trim()) {
      colors[token as ThemeToken] = value.trim();
    }
  });

  return {
    id: definition.id,
    name: definition.name || definition.id,
    dark: definition.dark ?? parent.dark,
    builtIn: builtInThemeIds.has(definition.id),
    colors,
    radius: definition.radius ?? parent.radius,
    blur: definition.blur ?? parent.blur,
    uiFont: definition.uiFont ?? parent.uiFont,
    customCss: [parent.customCss, definition.customCss || ''].filter(Boolean).join('\n')
  };
}

export function allThemeDefinitions(customThemes: Record<string, ThemeDefinition>) {
  return [...builtInThemes, ...Object.values(customThemes)];
}

export function slugifyThemeId(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'custom'
  );
}

export function uniqueThemeId(base: string, customThemes: Record<string, ThemeDefinition>) {
  let id = slugifyThemeId(base);

  if (!id.endsWith('-theme')) {
    id = `${id}-theme`;
  }

  let candidate = id;
  let index = 2;

  while (reservedIds.has(candidate) || customThemes[candidate]) {
    candidate = id.replace(/-theme$/, `-${index}-theme`);
    index += 1;
  }

  return candidate;
}

export function isValidColor(value: string) {
  return typeof CSS !== 'undefined' && CSS.supports('color', value);
}

/**
 * Checks an imported theme and returns it cleaned up, or throws with a message
 * that says what is wrong.
 */
export function parseThemeDefinition(input: unknown): ThemeDefinition {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('A theme must be a JSON object');
  }

  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '';

  if (!name) {
    throw new Error('The theme needs a "name"');
  }

  const theme: ThemeDefinition = {
    id: typeof raw.id === 'string' ? slugifyThemeId(raw.id) : slugifyThemeId(name),
    name
  };

  if (raw.extends !== undefined) {
    if (typeof raw.extends !== 'string') {
      throw new Error('"extends" must be a theme id');
    }
    theme.extends = raw.extends;
  }

  if (raw.dark !== undefined) {
    theme.dark = !!raw.dark;
  }

  if (raw.colors !== undefined) {
    if (!raw.colors || typeof raw.colors !== 'object') {
      throw new Error('"colors" must be an object');
    }

    const known = new Set(themeTokens.map((token) => token.token));
    const colors: Partial<ThemeColors> = {};

    Object.entries(raw.colors as Record<string, unknown>).forEach(([token, value]) => {
      if (!known.has(token as ThemeToken)) {
        throw new Error(`Unknown colour "${token}"`);
      }
      if (typeof value !== 'string' || !isValidColor(value)) {
        throw new Error(`"${token}" is not a valid CSS colour: ${String(value)}`);
      }
      colors[token as ThemeToken] = value;
    });

    theme.colors = colors;
  }

  const numberOption = (key: 'radius' | 'blur', min: number, max: number) => {
    if (raw[key] === undefined) {
      return;
    }
    const value = Number(raw[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`"${key}" must be a number from ${min} to ${max}`);
    }
    theme[key] = value;
  };

  numberOption('radius', 0, 3);
  numberOption('blur', 0, 64);

  if (typeof raw.uiFont === 'string') {
    theme.uiFont = raw.uiFont;
  }

  if (typeof raw.customCss === 'string') {
    theme.customCss = raw.customCss;
  }

  return theme;
}

/** Upstream custom themes only had reader colours, as rgba strings. */
export function migrateLegacyTheme(
  name: string,
  legacy: Record<string, string>
): ThemeDefinition | undefined {
  if (!legacy?.backgroundColor) {
    return undefined;
  }

  const [r, g, b] = (legacy.backgroundColor.match(/[\d.]+/g) || ['255', '255', '255']).map(Number);
  const dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
  const mapping: Record<string, ThemeToken> = {
    fontColor: 'readerText',
    backgroundColor: 'readerBackground',
    selectionFontColor: 'selectionText',
    selectionBackgroundColor: 'selectionBackground',
    hintFuriganaFontColor: 'furiganaHintText',
    hintFuriganaShadowColor: 'furiganaHintShadow',
    tooltipTextFontColor: 'footerText'
  };
  const colors: Partial<ThemeColors> = {};

  Object.entries(mapping).forEach(([legacyKey, token]) => {
    if (legacy[legacyKey]) {
      colors[token] = legacy[legacyKey];
    }
  });

  return { id: name, name, extends: dark ? 'dark' : 'light', colors };
}

/** Definition to export: only what differs from the theme it extends. */
export function exportableTheme(definition: ThemeDefinition) {
  return JSON.stringify({ $format: themeFormatVersion, ...definition }, null, 2);
}

/** Colours in the shape the reader components take. */
export function toReaderThemeOption(theme: ResolvedTheme): ThemeOption {
  const { colors } = theme;

  return {
    fontColor: colors.readerText,
    backgroundColor: colors.readerBackground,
    selectionFontColor: colors.selectionText,
    selectionBackgroundColor: colors.selectionBackground,
    hintFuriganaFontColor: colors.furiganaHintText,
    hintFuriganaShadowColor: colors.furiganaHintShadow,
    tooltipTextFontColor: colors.footerText
  };
}
