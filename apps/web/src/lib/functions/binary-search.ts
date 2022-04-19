/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

function binarySearchImpl(notFoundValue: -1 | undefined) {
  const binarySearchRecursive = (arr: number[], l: number, r: number, x: number): number => {
    if (r < l) return notFoundValue ?? r;

    const mid = Math.floor((l + r) / 2);
    if (arr[mid] === x) return mid;
    if (arr[mid] > x) return binarySearchRecursive(arr, l, mid - 1, x);
    return binarySearchRecursive(arr, mid + 1, r, x);
  };

  return (arr: number[], x: number) => binarySearchRecursive(arr, 0, arr.length - 1, x);
}

export const binarySearch = binarySearchImpl(-1);
export const binarySearchNoNegative = binarySearchImpl(undefined);
