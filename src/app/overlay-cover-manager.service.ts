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
export class OverlayCoverManagerService {
  el = document.createElement('div');

  borderSize = 0;

  constructor() {
    this.el.classList.add('overlay-cover');
  }

  updateOverlaySize() {
    const idealSize = 1450;
    const borderSize = Math.max((window.innerWidth - idealSize) / 2, 0);
    const borderSizePx = `${borderSize}px`;
    this.el.style.borderLeftWidth = borderSizePx;
    this.el.style.borderRightWidth = borderSizePx;
    document.body.style.paddingLeft = borderSizePx;
    document.body.style.paddingRight = borderSizePx;
    this.borderSize = borderSize;
  }
}
