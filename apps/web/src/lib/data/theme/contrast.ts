/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * WCAG contrast of a theme's main colour pairs. Used by the theme test (built-in
 * themes) and the theme editor (a warning for custom ones). Not part of upstream.
 */

import type { RgbaColor } from '$lib/data/theme/color-utils';
import type { ThemeColors, ThemeToken } from '$lib/data/theme/theme-tokens';

/** WCAG AA for normal text */
export const minimumContrast = 4.5;

/** Text tokens and the backgrounds they sit on. Translucent backgrounds sit on `background`. */
export const contrastPairs: [ThemeToken, ThemeToken][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceStrong'],
  ['mutedText', 'background'],
  ['mutedText', 'surface'],
  ['mutedText', 'surfaceStrong'],
  ['accentText', 'accent'],
  ['readerText', 'readerBackground'],
  ['panelText', 'panelBackground']
];

/** Hex and rgb()/rgba() only; anything else (var(), color-mix()) needs a browser. */
export function parseSimpleColor(value: string): RgbaColor | undefined {
  const hex = value.trim().match(/^#([0-9a-f]{3,8})$/i)?.[1];

  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const [r, g, b, a = 255] = (full.match(/../g) ?? []).map((pair) => parseInt(pair, 16));
    return { r, g, b, a: a / 255 };
  }

  const numbers = value.match(/^\s*rgba?\(([^)]*)\)\s*$/i)?.[1].match(/[\d.]+%?/g);

  if (!numbers || numbers.length < 3) {
    return undefined;
  }

  const alpha = numbers[3];

  return {
    r: Number(numbers[0]),
    g: Number(numbers[1]),
    b: Number(numbers[2]),
    a: alpha === undefined ? 1 : alpha.endsWith('%') ? parseFloat(alpha) / 100 : Number(alpha)
  };
}

function over(top: RgbaColor, bottom: RgbaColor): RgbaColor {
  const mix = (a: number, b: number) => a * top.a + b * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }: RgbaColor) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrastRatio(foreground: RgbaColor, background: RgbaColor) {
  const a = luminance(over(foreground, background));
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export interface ContrastIssue {
  foreground: ThemeToken;
  background: ThemeToken;
  ratio: number;
}

/**
 * Pairs below WCAG AA. `parse` turns a colour into RGBA: `parseSimpleColor`
 * without a browser, `parseCssColor` in one. Unparseable pairs are skipped.
 */
export function contrastIssues(
  colors: ThemeColors,
  parse: (value: string) => RgbaColor | undefined = parseSimpleColor
): ContrastIssue[] {
  const page = parse(colors.background);

  if (!page) {
    return [];
  }

  const solidPage = over(page, { r: 255, g: 255, b: 255, a: 1 });
  const issues: ContrastIssue[] = [];

  contrastPairs.forEach(([foreground, background]) => {
    const fg = parse(colors[foreground]);
    const bg = parse(colors[background]);

    if (!fg || !bg) {
      return;
    }

    const ratio = contrastRatio(fg, over(bg, solidPage));

    if (ratio < minimumContrast) {
      issues.push({ foreground, background, ratio: Math.round(ratio * 100) / 100 });
    }
  });

  return issues;
}
