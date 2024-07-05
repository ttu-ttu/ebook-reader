/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import type { PageManager } from '../types';

export class PageManagerContinuous implements PageManager {
  constructor(
    private verticalMode: boolean,
    private firstDimensionMargin: number,
    private window: Window
  ) {}

  nextPage() {
    this.scrollByPercent(0.95);
  }

  prevPage() {
    this.scrollByPercent(-0.95);
  }

  updateSectionDataByOffset() {
    // no-op
  }

  scrollTo(pos: number) {
    this.window.scrollTo({
      [this.verticalMode ? 'left' : 'top']: pos
    });
  }

  private scrollByPercent(value: number) {
    let windowSize = this.window.innerHeight;
    let scrollSide: 'left' | 'top' = 'top';
    let scale = 1;

    if (this.verticalMode) {
      windowSize = this.window.innerWidth;
      scrollSide = 'left';
      scale = -1;
    }
    const pageSize = windowSize - this.firstDimensionMargin * 2;
    this.window.scrollBy({
      [scrollSide]: pageSize * value * scale,
      behavior: 'smooth'
    });
  }
}
