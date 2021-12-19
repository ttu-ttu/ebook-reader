/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { configure as zipConfigure } from '@zip.js/zip.js';
import UAParser from 'ua-parser-js';

export default function initZipSettings() {
  const parseResult = new UAParser(window.navigator.userAgent).getResult();
  const isKiwiBrowser =
    parseResult.os.name === 'Android' && parseResult.browser.name === 'Chrome';
  zipConfigure({
    useWebWorkers: !isKiwiBrowser,
  });
}
