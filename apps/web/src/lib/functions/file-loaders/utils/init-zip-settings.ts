/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { configure as zipConfigure } from '@zip.js/zip.js';
import UAParser from 'ua-parser-js';

export default function initZipSettings() {
  zipConfigure({
    useWebWorkers: !isKiwiBrowser()
  });
}

function isKiwiBrowser() {
  if (typeof window === 'undefined') return false;
  const parseResult = new UAParser(window.navigator.userAgent).getResult();
  return parseResult.os.name === 'Android' && parseResult.browser.name === 'Chrome';
}
