/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

function binarySearchRecursive(
  arr: number[],
  l: number,
  r: number,
  x: number,
  withFallbackIndex: boolean
): number {
  if (r >= l) {
    const mid = Math.floor((l + r) / 2);
    if (arr[mid] === x) {
      return mid;
    }
    if (arr[mid] > x) {
      return binarySearchRecursive(arr, l, mid - 1, x, withFallbackIndex);
    }
    return binarySearchRecursive(arr, mid + 1, r, x, withFallbackIndex);
  }
  return withFallbackIndex ? r : -1;
}

export default function binarySearch(
  arr: number[],
  x: number,
  withFallbackIndex = false
) {
  return binarySearchRecursive(arr, 0, arr.length - 1, x, withFallbackIndex);
}
