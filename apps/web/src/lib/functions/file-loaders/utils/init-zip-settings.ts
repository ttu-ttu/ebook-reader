/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { configure as zipConfigure } from '@zip.js/zip.js';

export default function initZipSettings() {
  zipConfigure({
    useWebWorkers: !isKiwiBrowser()
  });
}

/**
 * Browsers that put "Chrome/" in their user agent but name themselves too, so that ua-parser-js
 * did not report them as Chrome: Android WebView ("; wv)"), Samsung Internet, Edge, Opera,
 * Yandex, UC Browser, Mi Browser, Huawei Browser and DuckDuckGo.
 */
const OTHER_CHROMIUM_BROWSERS =
  /; wv\)|SamsungBrowser\/|EdgA\/|OPR\/|YaBrowser\/|UCBrowser\/|MiuiBrowser\/|HuaweiBrowser\/|DuckDuckGo\//;

/**
 * Kiwi Browser sends Chrome's user agent, so this is Chrome on Android as ua-parser-js 1.x
 * reported it. (2.x names it "Mobile Chrome" on phones, so the check had only matched tablets.)
 */
function isKiwiBrowser() {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent;
  return (
    /Android/.test(userAgent) &&
    /Chrome\/[\d.]+/.test(userAgent) &&
    !OTHER_CHROMIUM_BROWSERS.test(userAgent)
  );
}
