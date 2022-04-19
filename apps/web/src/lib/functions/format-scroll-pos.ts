/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

export function formatScrollPos(scrollPos: number, verticalMode: boolean) {
  return verticalMode ? -scrollPos : scrollPos;
}
