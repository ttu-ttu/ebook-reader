/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { writableSubject } from '$lib/functions/svelte/store';

export function isMobile(window: Window) {
  const UA = window.navigator.userAgent;
  const userAgentRegex = /\b(BlackBerry|webOS|iPhone|IEMobile|Android|Windows Phone|iPad|iPod)\b/i;

  if (('maxTouchPoints' in window.navigator) as any) {
    return window.navigator.maxTouchPoints > 0;
  }

  if (('msMaxTouchPoints' in window.navigator) as any) {
    return window.navigator.msMaxTouchPoints > 0;
  }

  const mQ = window.matchMedia?.('(pointer:coarse)');
  if (mQ?.media === '(pointer: coarse)') {
    return !!mQ.matches;
  }

  if ('orientation' in window) {
    return true;
  }
  return userAgentRegex.test(UA);
}

export function isOnOldUrl(window: Window) {
  return window.location.href.startsWith('https://ttu-ebook.web.app');
}

export function dummyFn() {}

export const isMobile$ = writableSubject<boolean>(false);
