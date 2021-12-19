/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

export default function isElementGaiji(el: HTMLImageElement) {
  return Array.from(el.classList).some((className) =>
    className.includes('gaiji')
  );
}
