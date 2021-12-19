/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

export default function formatScrollPos(
  scrollPos: number,
  verticalMode: boolean
) {
  return verticalMode ? -scrollPos : scrollPos;
}
