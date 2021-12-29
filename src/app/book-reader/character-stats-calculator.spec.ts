/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import CharacterStatsCalculator from './character-stats-calculator';

describe('CharacterStatsCalculator', () => {
  it('should count gaiji', () => {
    const calculator = createCalculator(`
    あ<img class="gaiji">い
    `);
    expect(calculator.charCount).toEqual(3);
  });

  it('should count gaiji in ruby', () => {
    const calculator = createCalculator(`
    <ruby>
      <img class="gaiji">
      <rt>ああ</rt>
    </ruby>
    `);
    expect(calculator.charCount).toEqual(1);
  });

  it('should count gaiji in rp', () => {
    const calculator = createCalculator(`
    <ruby>
      <rp><img class="gaiji"></rp>
      <rt>ああ</rt>
    </ruby>
    `);
    expect(calculator.charCount).toEqual(1);
  });
});

function createCalculator(html: string) {
  const document = TestBed.inject(DOCUMENT);
  const containerEl = document.createElement('div');
  containerEl.innerHTML = html;

  return new CharacterStatsCalculator(
    containerEl,
    false,
    document.documentElement,
    document
  );
}
