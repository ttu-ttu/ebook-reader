/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import CharacterStatsCalculator from './character-stats-calculator';

export default class ScrollStabilizer {
  stabilizing = false;

  latestScrollStats?: {
    containerWidth: number;
    exploredCharCount: number;
  };

  constructor(private window: Window) {}

  onResize(containerWidth: number, calculator: CharacterStatsCalculator) {
    if (
      this.latestScrollStats &&
      Math.abs(this.latestScrollStats.containerWidth - containerWidth) > 10
    ) {
      const scrollPos = calculator.getScrollPosByCharCount(
        this.latestScrollStats.exploredCharCount
      );
      this.stabilizing = true;
      this.window.scrollTo(scrollPos, 0);
      this.latestScrollStats.containerWidth = containerWidth;
    }
  }
}
