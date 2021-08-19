/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { 
  createBooleanLocalStorageBehaviorSubject,
  createNumberLocalStorageBehaviorSubject } from './utils/local-storage-utils';

// https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt
const isNotJapaneseRegex = /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Ideographic}\p{Radical}\p{Unified_Ideograph}]+/gmiu;

type loadingProgress = {
  title: string;
  progress: string;
};

@Injectable({
  providedIn: 'root'
})
export class EbookDisplayManagerService {

  loadingFile$ = new BehaviorSubject<boolean>(false);
  loadingFiles$ = new BehaviorSubject<loadingProgress | undefined>(undefined);
  contentEl = document.createElement('div');
  contentChanged = new Subject<void>();
  revalidateFile = new Subject<void>();

  fontSize$: BehaviorSubject<number>;
  hideSpoilerImage$: BehaviorSubject<boolean>;
  hideFurigana$: BehaviorSubject<boolean>;
  allowScroll = true;
  totalCharCount = 0;

  private bookStyle = document.createElement('style');

  constructor() {
    document.head.insertBefore(this.bookStyle, document.head.firstChild);

    this.fontSize$ = createNumberLocalStorageBehaviorSubject('fontSize', 20);
    this.hideSpoilerImage$ = createBooleanLocalStorageBehaviorSubject('hideSpoilerImage', true);
    this.hideFurigana$ = createBooleanLocalStorageBehaviorSubject('hideFurigana', false);
  }

  updateContent(el: HTMLElement, styleString: string) {
    if (this.contentEl.firstChild) {
      this.contentEl.replaceChild(el, this.contentEl.firstChild);
    } else {
      this.contentEl.appendChild(el);
    }

    const styleNode = document.createTextNode(styleString);
    if (this.bookStyle.firstChild) {
      this.bookStyle.replaceChild(styleNode, this.bookStyle.firstChild);
    } else {
      this.bookStyle.appendChild(styleNode);
    }
    this.contentChanged.next();
  }

  getCharCount(el: HTMLElement) {
    const totalLength = countUnicodeCharacters(el.innerText.replace(isNotJapaneseRegex, ''));
    let totalRtLength = 0;
    for (const rtTag of el.getElementsByTagName('rt')) {
      totalRtLength += countUnicodeCharacters(rtTag.innerText.replace(isNotJapaneseRegex, ''));
    }
    let totalCustomCharLength = 0;
    for (const spoilerEl of el.getElementsByClassName('spoiler-label')) {
      totalCustomCharLength += countUnicodeCharacters((spoilerEl as HTMLElement).innerText.replace(isNotJapaneseRegex, ''));
    }
    for (const placeholderEl of el.getElementsByClassName('placeholder-br')) {
      totalCustomCharLength += countUnicodeCharacters((placeholderEl as HTMLElement).innerText.replace(isNotJapaneseRegex, ''));
    }
    let imageTextCount = 0;
    for (const imgTag of el.getElementsByTagName('img')) {
      if ([...imgTag.classList.values()].some((className) => className.includes('gaiji'))) {
        imageTextCount += 1;
      }
    }
    return totalLength - totalRtLength - totalCustomCharLength + imageTextCount;
  }
}

/**
 * Because '𠮟る'.length = 3
 * Reference: https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/#length-and-surrogate-pairs
 */
function countUnicodeCharacters(s: string) {
  return [...s].length;
}
