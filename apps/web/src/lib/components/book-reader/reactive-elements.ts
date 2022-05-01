/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { fromEvent, merge, take, tap } from 'rxjs';

import { FuriganaStyle } from '../../data/furigana-style';

export function reactiveElements(document: Document, furiganaStyle: FuriganaStyle) {
  const anchorTagDocumentListener = anchorTagListener(document);
  const spoilerImageDocumentListener = spoilerImageListener(document);

  return (contentEl: HTMLElement) =>
    merge(
      anchorTagDocumentListener(contentEl),
      rubyTagListener(contentEl, furiganaStyle),
      spoilerImageDocumentListener(contentEl)
    );
}

function anchorTagListener(document: Document) {
  return (contentEl: HTMLElement) => {
    const anchorTags = Array.from(contentEl.getElementsByTagName('a'));
    anchorTags.forEach((el) => {
      // eslint-disable-next-line no-param-reassign
      el.href = document.location.pathname + el.hash;
    });

    const obs$ = anchorTags.map((el) =>
      fromClickEvent(el).pipe(
        tap(() => {
          const targetEl = document.getElementById(el.hash.substring(1));
          if (targetEl) {
            targetEl.scrollIntoView();
          }
        })
      )
    );
    return merge(...obs$);
  };
}

function rubyTagListener(contentEl: HTMLElement, furiganaStyle: FuriganaStyle) {
  const isToggle = furiganaStyle === FuriganaStyle.Toggle;
  const rubyTags = Array.from(contentEl.getElementsByTagName('ruby'));
  const obs$ = rubyTags.map((el) =>
    isToggle
      ? fromClickEvent(el).pipe(
          tap(() => {
            el.classList.toggle('reveal-rt');
          })
        )
      : fromClickEvent(el).pipe(
          take(1),
          tap(() => {
            el.classList.add('reveal-rt');
          })
        )
  );
  return merge(...obs$);
}

function spoilerImageListener(document: Document) {
  return (contentEl: HTMLElement) => {
    const elements = Array.from(contentEl.querySelectorAll('[data-ttu-spoiler-img]'));
    const obs$ = elements.map((el) => {
      const spoilerLabelEl = document.createElement('span');
      spoilerLabelEl.classList.add('spoiler-label');
      spoilerLabelEl.setAttribute('aria-hidden', 'true');
      spoilerLabelEl.innerText = 'ネタバレ';
      el.appendChild(spoilerLabelEl);
      return fromClickEvent(el).pipe(
        take(1),
        tap(() => {
          el.removeChild(spoilerLabelEl);
          el.removeAttribute('data-ttu-spoiler-img');
        })
      );
    });
    return merge(...obs$);
  };
}

function fromClickEvent(el: Element) {
  return fromEvent(el, 'click').pipe(
    tap((ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    })
  );
}
