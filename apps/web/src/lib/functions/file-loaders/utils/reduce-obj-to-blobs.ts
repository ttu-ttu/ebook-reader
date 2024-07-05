/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export default function reduceObjToBlobs<T>(data: Record<string, T | Blob>) {
  return Object.entries(data)
    .filter((d): d is [string, Blob] => d[1] instanceof Blob)
    .reduce<Record<string, Blob>>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});
}
