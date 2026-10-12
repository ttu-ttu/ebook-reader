/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Colour helpers for the theme editor. Not part of upstream.
 */

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

let probe: HTMLElement | undefined;

/** Any CSS colour (names, hex, rgb(), hsl(), color-mix()...) as RGBA, via the browser. */
export function parseCssColor(value: string): RgbaColor | undefined {
  if (typeof document === 'undefined' || !CSS.supports('color', value)) {
    return undefined;
  }

  if (!probe) {
    probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.append(probe);
  }

  probe.style.color = '';
  probe.style.color = value;

  const computed = getComputedStyle(probe).color;
  const numbers = computed.match(/[\d.]+/g)?.map(Number);

  if (!numbers || numbers.length < 3) {
    return undefined;
  }

  // srgb from color(srgb r g b / a) is 0-1, rgb() is 0-255
  const scale = computed.startsWith('color(') ? 255 : 1;

  return {
    r: Math.round(numbers[0] * scale),
    g: Math.round(numbers[1] * scale),
    b: Math.round(numbers[2] * scale),
    a: numbers[3] ?? 1
  };
}

export function toHex({ r, g, b }: RgbaColor) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export function fromHexAndAlpha(hex: string, alpha: number) {
  if (alpha >= 1) {
    return hex;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
}
