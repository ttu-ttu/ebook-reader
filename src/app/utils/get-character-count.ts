/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import isElementGaiji from './is-element-gaiji';

const isNotJapaneseRegex = /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

export default function getCharacterCount(el: HTMLElement) {
  const totalLength = countUnicodeCharacters(
    el.innerText.replace(isNotJapaneseRegex, '')
  );
  let totalRtLength = 0;
  for (const rtTag of el.getElementsByTagName('rt')) {
    totalRtLength += countUnicodeCharacters(
      rtTag.innerText.replace(isNotJapaneseRegex, '')
    );
  }
  let totalCustomCharLength = 0;
  for (const spoilerEl of el.getElementsByClassName('spoiler-label')) {
    totalCustomCharLength += countUnicodeCharacters(
      (spoilerEl as HTMLElement).innerText.replace(isNotJapaneseRegex, '')
    );
  }
  let imageTextCount = 0;
  for (const imgTag of el.getElementsByTagName('img')) {
    if (isElementGaiji(imgTag)) {
      imageTextCount += 1;
    }
  }
  return totalLength - totalRtLength - totalCustomCharLength + imageTextCount;
}

/**
 * Because '𠮟る'.length = 3
 * Reference: https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/#length-and-surrogate-pairs
 */
function countUnicodeCharacters(s: string) {
  return [...s].length;
}
