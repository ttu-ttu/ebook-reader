/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { isElementGaiji } from './is-element-gaiji';

export function isNodeGaiji(node: Node) {
  if (!(node instanceof HTMLImageElement)) {
    return false;
  }
  return isElementGaiji(node);
}
