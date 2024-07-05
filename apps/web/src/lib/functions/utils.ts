/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { StorageKey } from '$lib/data/storage/storage-types';
import { getCharacterCount } from './get-character-count';
import { writableSubject } from '$lib/functions/svelte/store';

function externalTargetFilterFunction(element: HTMLElement) {
  return getCharacterCount(element) > 0;
}

export function isMobile(window: Window) {
  const UA = window.navigator.userAgent;
  const userAgentRegex = /\b(BlackBerry|webOS|iPhone|IEMobile|Android|Windows Phone|iPad|iPod)\b/i;

  if (('maxTouchPoints' in window.navigator) as any) {
    return window.navigator.maxTouchPoints > 0;
  }

  if (('msMaxTouchPoints' in window.navigator) as any) {
    return window.navigator.msMaxTouchPoints > 0;
  }

  const mQ = window.matchMedia?.('(pointer:coarse)');
  if (mQ?.media === '(pointer: coarse)') {
    return !!mQ.matches;
  }

  if ('orientation' in window) {
    return true;
  }
  return userAgentRegex.test(UA);
}

export function isOnOldUrl(window: Window) {
  return window.location.href.startsWith('https://ttu-ebook.web.app');
}

export function dummyFn() {}

export const isMobile$ = writableSubject<boolean>(false);

export function isOnlineSourceAvailable(isOnline: boolean, storageKey: StorageKey) {
  return isOnline || (storageKey !== StorageKey.GDRIVE && storageKey !== StorageKey.ONEDRIVE);
}

export function caluclatePercentage(x: number, y: number) {
  return Math.floor((x / y) * 100);
}

export function filterNotNullAndNotUndefined<T>(
  value: T | null | undefined
): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function randomize(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function getWeightedAverage(values: number[], weights: number[]) {
  let sum = 0;
  let weightedSum = 0;

  for (let index = 0, { length } = values; index < length; index += 1) {
    sum += values[index] * weights[index];
    weightedSum += weights[index];
  }

  return sum / weightedSum;
}

export function limitToRange(minValue: number, maxValue: number, currentValue: number) {
  return Math.min(Math.max(currentValue, minValue), maxValue);
}

export function pluralize(value: number, term: string, printValue = true) {
  return `${printValue ? `${value} ` : ''}${term}${value !== 1 ? 's' : ''}`;
}

export function getFullHeight(window: Window, element: HTMLElement, addSurroundings = false) {
  const { borderTopWidth, borderBottomWidth, paddingTop, paddingBottom, marginTop, marginBottom } =
    window.getComputedStyle(element);

  return addSurroundings
    ? element.clientHeight +
        convertComputedStyleToNumber(borderTopWidth) +
        convertComputedStyleToNumber(borderBottomWidth) +
        convertComputedStyleToNumber(paddingTop) +
        convertComputedStyleToNumber(paddingBottom) +
        convertComputedStyleToNumber(marginTop) +
        convertComputedStyleToNumber(marginBottom)
    : element.clientHeight -
        convertComputedStyleToNumber(borderTopWidth) -
        convertComputedStyleToNumber(borderBottomWidth) -
        convertComputedStyleToNumber(paddingTop) -
        convertComputedStyleToNumber(paddingBottom) -
        convertComputedStyleToNumber(marginTop) -
        convertComputedStyleToNumber(marginBottom);
}

function convertComputedStyleToNumber(value: string) {
  return Number.parseInt(value.replace('px', ''), 10);
}

export function convertRemToPixels(window: Window, rem: number) {
  return rem * parseFloat(window.getComputedStyle(document.documentElement).fontSize);
}

export function getExternalTargetElement(source: Document | Element, selector: string) {
  const elements = [...source.querySelectorAll<HTMLSpanElement>(selector)].filter(
    externalTargetFilterFunction
  );

  return elements[elements.length - 1];
}
