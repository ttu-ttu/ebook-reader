/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

export function generateUUID() {
  const array = new Uint32Array(16);
  window.crypto.getRandomValues(array);
  let str = '';

  for (let i = 0; i < array.length; i += 1) {
    str += (i < 2 || i > 5 ? '' : '-') + array[i].toString(16).slice(-4);
  }

  return str;
}
