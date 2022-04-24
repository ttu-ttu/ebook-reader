/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { isNodeGaiji } from './is-node-gaiji';

export function getCharacterCount(node: Node) {
  return isNodeGaiji(node) ? 1 : getRawCharacterCount(node);
}

const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

function getRawCharacterCount(node: Node) {
  if (!node.textContent) return 0;
  return countUnicodeCharacters(node.textContent.replace(isNotJapaneseRegex, ''));
}

/**
 * Because '𠮟る'.length = 3
 * Reference: https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/#length-and-surrogate-pairs
 */
function countUnicodeCharacters(s: string) {
  return Array.from(s).length;
}
