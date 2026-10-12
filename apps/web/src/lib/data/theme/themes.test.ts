/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it, vi } from 'vitest';
import { contrastIssues, contrastRatio, parseSimpleColor } from '$lib/data/theme/contrast';
import {
  builtInThemes,
  defaultDarkThemeId,
  defaultLightThemeId,
  parseThemeDefinition,
  resolveTheme
} from '$lib/data/theme/themes';
import { themeTokens } from '$lib/data/theme/theme-tokens';

describe('themes', () => {
  it('defaults to Washi (light) and Sumi (dark)', () => {
    expect(resolveTheme(defaultLightThemeId, {})).toMatchObject({ name: 'Washi', dark: false });
    expect(resolveTheme(defaultDarkThemeId, {})).toMatchObject({ name: 'Sumi', dark: true });
    expect(resolveTheme('no-such-theme', {}).id).toBe(defaultLightThemeId);
  });

  it('gives every theme a value for every token', () => {
    builtInThemes.forEach(({ id }) => {
      const { colors } = resolveTheme(id, {});
      themeTokens.forEach(({ token }) => expect(colors[token], `${id} ${token}`).toBeTruthy());
    });
  });

  it('fills tokens added later into custom themes made before them', () => {
    const old = { id: 'old-theme', name: 'Old', extends: 'dark', colors: { accent: '#ff00aa' } };
    const { colors } = resolveTheme(old.id, { [old.id]: old });

    expect(colors.accent).toBe('#ff00aa');
    expect(colors.toggleOn).toBe('var(--accent-color)');
    expect(colors.difficulty3).toBeTruthy();
  });

  it('accepts the new tokens in imported themes', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    expect(parseThemeDefinition({ name: 'X', colors: { progressFill: 'red' } }).colors).toEqual({
      progressFill: 'red'
    });
  });
});

describe('contrast', () => {
  it('computes WCAG ratios', () => {
    const black = parseSimpleColor('#000')!;
    const white = parseSimpleColor('rgb(255, 255, 255)')!;

    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseSimpleColor('rgba(0, 0, 0, 0)')!, white)).toBeCloseTo(1, 5);
  });

  // Dev-time check: every built-in theme meets WCAG AA for its main text pairs.
  it('keeps built-in themes readable', () => {
    const report = builtInThemes.flatMap(({ id }) =>
      contrastIssues(resolveTheme(id, {}).colors).map(
        (issue) => `${id}: ${issue.foreground} on ${issue.background} is ${issue.ratio}:1`
      )
    );

    expect(report, 'Below WCAG AA (4.5:1)').toEqual([]);
  });
});
