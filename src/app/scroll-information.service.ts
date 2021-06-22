/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 *   All rights reserved.
 *
 *   This source code is licensed under the BSD-style license found in the
 *   LICENSE file in the root directory of this source tree.
 */

import { Injectable, NgZone } from '@angular/core';
import { EbookDisplayManagerService } from './ebook-display-manager.service';

@Injectable({
  providedIn: 'root'
})
export class ScrollInformationService {
  el = document.createElement('div');

  /**
   * Doesn't matter what's returned here, just placeholder
   */
  paragraphs: Iterable<HTMLElement> & { length: number } = [];

  paragraphPos: number[] = Array(this.paragraphs.length);
  charCount: number[] = Array(this.paragraphs.length);
  exploredCharCount = 0;

  constructor(private ebookDisplayManagerService: EbookDisplayManagerService, private zone: NgZone) {
    this.el.classList.add('information-overlay', 'bottom-overlay', 'scroll-information');

    this.zone.runOutsideAngular(() => {
      let visible = true;
      this.el.addEventListener('click', () => {
        if (visible) {
          this.el.style.opacity = '0';
        } else {
          this.el.style.removeProperty('opacity');
        }
        visible = !visible;
      });
    });
  }

  updateParagraphPos() {
    this.paragraphPos = [];
    this.charCount = [];
    let exploredCharCount = 0;
    for (const el of this.paragraphs) {
      this.paragraphPos.push(document.documentElement.offsetWidth - el.offsetLeft);
      exploredCharCount += this.ebookDisplayManagerService.getCharCount(el);
      this.charCount.push(exploredCharCount);
    }
  }

  initWatchParagraphs(el: HTMLElement) {
    this.paragraphs = el.getElementsByTagName('p');

    if (this.paragraphs.length === 0) {
      const potentialParagraphs = Array.from(el.querySelectorAll( '*' ))
        .filter( (p): p is HTMLElement => p instanceof HTMLElement
          && !p.attributes.getNamedItem('aria-hidden')
          && p.parentElement?.tagName !== 'RUBY')
        .filter((p) => {
          for (const pChild of p.childNodes) {
            if (pChild.nodeType === Node.TEXT_NODE && pChild.textContent && pChild.textContent.trim().length > 0) {
              return true;
            }
          }
          return false;
        });
      const potentialParagraphsSet = new Set(potentialParagraphs);
      // tslint:disable-next-line:no-non-null-assertion
      this.paragraphs = potentialParagraphs.filter((p) => !potentialParagraphsSet.has(p.parentElement!));
    }
  }

  updateScrollPercent(offsetWidth: number, totalCharCount: number) {
    const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
    this.exploredCharCount = this.getCharCount(Math.abs(scrollLeft) + offsetWidth);
    this.el.innerText = `${this.exploredCharCount}/${totalCharCount} (${((this.exploredCharCount / totalCharCount) * 100).toFixed(2)}%)`;
  }

  getCharCount(scrollPos: number) {
    const index = binarySearch(this.paragraphPos, 0, this.paragraphPos.length - 1, scrollPos);
    return this.charCount[index] || 0;
  }

  getScrollPos(charCount: number) {
    const index = binarySearch(
      this.charCount,
      0,
      this.charCount.length - 1,
      charCount,
    );
    return this.paragraphPos[index];
  }
}

function binarySearch(arr: number[], l: number, r: number, x: number): number {
  if (r >= l) {
    const mid = Math.floor((l + r) / 2);
    if (arr[mid] === x) {
      return mid;
    }
    if (arr[mid] > x) {
      return binarySearch(arr, l, mid - 1, x);
    }
    return binarySearch(arr, mid + 1, r, x);
  }
  return r;
}
