/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FullscreenService {
  get fullscreenEnabled() {
    return (
      this.fallbackSpec('fullscreenEnabled', ['webkitFullscreenEnabled']) ??
      false
    );
  }

  get fullscreenElement() {
    return (
      this.fallbackSpec('fullscreenElement', ['webkitFullscreenElement']) ??
      null
    );
  }

  constructor(@Inject(DOCUMENT) private document: Document) {}

  async requestFullscreen(el: Element, fullscreenOptions?: FullscreenOptions) {
    const fn = fallbackSpec(el, 'requestFullscreen', [
      'webkitRequestFullscreen',
    ]);
    if (!fn) {
      return;
    }
    await fn(fullscreenOptions);
  }

  async exitFullscreen() {
    const fn = this.fallbackSpec('exitFullscreen', ['webkitExitFullscreen']);
    if (!fn) {
      return;
    }
    await fn();
  }

  private fallbackSpec<T extends keyof Document>(
    specName: T,
    aliases: string[]
  ) {
    return fallbackSpec(this.document, specName, aliases);
  }
}

function fallbackSpec<T, P extends keyof T>(
  obj: T,
  specName: P,
  aliases: string[]
) {
  return [specName]
    .concat(aliases as P[])
    .map((p) => tryGet(obj, p))
    .reduce((a, b) => a ?? b);
}

function tryGet<T, P extends keyof T>(obj: T, propertyName: P) {
  if (!(propertyName in obj)) {
    return undefined;
  }

  const val = obj[propertyName];
  if (typeof val === 'function') {
    return val.bind(obj) as typeof val;
  }
  return val;
}
