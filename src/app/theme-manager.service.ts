/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeManagerService {
  themeIndex = -1;

  readonly availableThemes = [
    'light-theme',
    'gray-theme',
    'dark-theme',
    'ecru-theme',
    'water-theme',
  ];

  constructor() {
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme) {
      this.themeIndex = this.availableThemes.findIndex((x) => x === storedTheme);
    }

    if (this.themeIndex < 0) {
      this.themeIndex = 0;
    }

    document.documentElement.classList.add(this.availableThemes[this.themeIndex]);
  }

  setTheme(themeIndex: number) {
    const previousTheme = this.availableThemes[this.themeIndex];
    this.themeIndex = themeIndex;
    const currentTheme = this.availableThemes[this.themeIndex];
    document.documentElement.classList.replace(previousTheme, currentTheme);

    localStorage.setItem('theme', currentTheme);
  }
}
