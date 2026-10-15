/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { browser } from '$app/environment';

class FullscreenManager {
  get fullscreenEnabled() {
    return this.fallbackSpec('fullscreenEnabled', 'webkitFullscreenEnabled') ?? false;
  }

  get fullscreenElement() {
    return this.fallbackSpec('fullscreenElement', 'webkitFullscreenElement') ?? null;
  }

  constructor(document: Document) {
    this.fallbackSpec = fallbackSpec(document);
  }

  async requestFullscreen(el: Element, fullscreenOptions?: FullscreenOptions) {
    const fn = fallbackSpec(el)('requestFullscreen', 'webkitRequestFullscreen');
    if (!fn) return;
    await fn(fullscreenOptions);
  }

  async exitFullscreen() {
    const fn = this.fallbackSpec('exitFullscreen', 'webkitExitFullscreen');
    if (!fn) return;
    await fn();
  }

  private fallbackSpec: <P extends keyof Document>(specName: P, alias: string) => Document[P];
}

function fallbackSpec<T>(obj: T) {
  return <P extends keyof T>(specName: P, alias: string) =>
    tryGet(obj, specName) ?? tryGet(obj, alias as P);
}

function tryGet<T, P extends keyof T>(obj: T, propertyName: P) {
  const val = obj[propertyName];
  if (typeof val === 'function') {
    return val.bind(obj) as typeof val;
  }
  return val;
}

export const fullscreenManager = new FullscreenManager(browser ? document : ({} as Document));
