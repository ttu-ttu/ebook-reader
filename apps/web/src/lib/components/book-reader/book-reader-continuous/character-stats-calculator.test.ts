/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { CharacterStatsCalculator } from './character-stats-calculator';

describe('CharacterStatsCalculator', () => {
  it('uses live container nodes for range-based bookmark counts after DOM replacement', () => {
    document.body.innerHTML = `
      <div id="scroll">
        <div id="book">
          <p>最初</p>
          <p>段落</p>
        </div>
      </div>
    `;

    const scrollEl = document.getElementById('scroll') as HTMLElement;
    const containerEl = document.getElementById('book') as HTMLElement;
    const calculator = new CharacterStatsCalculator(
      containerEl,
      'horizontal',
      'ltr',
      scrollEl,
      document
    );

    containerEl.innerHTML = `
      <p>最近</p>
      <p><span id="target">音楽</span></p>
    `;

    const targetText = document.getElementById('target')?.firstChild as Text;
    const range = document.createRange();
    range.setStart(targetText, 0);
    range.setEnd(targetText, targetText.textContent?.length ?? 0);

    expect(() => calculator.getCharCountToPoint(range)).not.toThrow();
    expect(calculator.getCharCountToPoint(range)).toBe(2);
  });
});
