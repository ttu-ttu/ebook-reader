/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 *   All rights reserved.
 *
 *   This source code is licensed under the BSD-style license found in the
 *   LICENSE file in the root directory of this source tree.
 */

import path from 'path-browserify';
import { EpubContents } from './epub-types';

function childNodesAfterContents(el: HTMLElement) {
  let childNodes = [...el.children];
  const afterContentsDivIndex = childNodes.findIndex((childNode) => childNode.getElementsByTagName('a').length > 1) + 1;
  if (afterContentsDivIndex > 0 && afterContentsDivIndex < childNodes.length) {
    childNodes = childNodes.slice(afterContentsDivIndex);
  }
  return childNodes;
}

/**
 * Clear all references that aren't packed, which could be caused by:
 * - Bad input file (doesn't include the required image)
 * - Bad image file extension
 */
function clearBadImageRef(el: HTMLElement) {
  for (const tag of el.getElementsByTagName('image')) {
    const hrefAttr = tag.getAttribute('href');
    if (hrefAttr && !(hrefAttr.startsWith('ttu:') || hrefAttr.startsWith('data:image/gif;ttu:'))) {
      tag.setAttribute('data-ttu-href', hrefAttr);
      tag.removeAttribute('href');
    }
  }
  for (const tag of el.getElementsByTagName('img')) {
    const srcAttr = tag.getAttribute('src');
    if (srcAttr && !(srcAttr.startsWith('ttu:') || srcAttr.startsWith('data:image/gif;ttu:'))) {
      tag.setAttribute('data-ttu-src', srcAttr);
      tag.removeAttribute('src');
    }
  }
}

export function getFormattedElementHtmlz(data: Record<string, string | Blob>) {
  // tslint:disable-next-line:no-non-null-assertion
  const regexResult = /.*<body[^>]*>((.|\s)+)<\/body>.*/.exec(data['index.html'] as string)!;
  let html = regexResult[1];
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Blob) {
      html = html.replaceAll(key, buildDummyBookImage(key));
    }
  }
  const result = document.createElement('div');
  result.innerHTML = html;

  for (const tag of result.getElementsByTagName('image')) {
    if (!tag.getAttributeNames().some((x) => x === 'href')) {
      for (const attrName of tag.getAttributeNames()) {
        if (attrName.endsWith('href')) {
          // tslint:disable-next-line:no-non-null-assertion
          tag.setAttribute('href', tag.getAttribute(attrName)!);
        }
      }
    }
  }
  for (const tag of result.getElementsByTagName('svg')) {
    tag.removeAttribute('width');
    tag.removeAttribute('height');
  }
  clearBadImageRef(result);

  for (const childNode of childNodesAfterContents(result)) {
    const createWrapper = (tag: Element) => {
      const imgWrapper = document.createElement('span');
      imgWrapper.toggleAttribute('data-ttu-spoiler-img');
      const parentElement = tag.parentElement || childNode;
      parentElement.insertBefore(imgWrapper, tag);
      imgWrapper.appendChild(tag);
    };

    for (const tag of childNode.getElementsByTagName('img')) {
      if (![...tag.classList.values()].some((className) => className.includes('gaiji'))) {
        createWrapper(tag);
      }
    }

    for (const tag of childNode.getElementsByTagName('svg')) {
      if (tag.getElementsByTagName('image').length) {
        createWrapper(tag);
      }
    }
  }

  for (const tag of result.getElementsByTagName('br')) {
    const placeholderEl = document.createElement('span'); // for Firefox
    placeholderEl.classList.add('placeholder-br');
    placeholderEl.setAttribute('aria-hidden', 'true');
    placeholderEl.innerText = '〇';
    const parentElement = tag.parentElement || result;
    parentElement.insertBefore(placeholderEl, tag);
  }

  return result;
}

const prependValue = 'ttu-';

export function getFormattedElementEpub(data: Record<string, string | Blob>, contents: EpubContents) {

  const htmlMap = contents.package.manifest.item.reduce<Record<string, string>>((acc, item) => {
    if (item['@_media-type'] === 'application/xhtml+xml') {
      acc[item['@_id']] = item['@_href'];
    }
    return acc;
  }, {});

  const blobsAvailable = Object.entries(data).reduce<string[]>((acc, [key, value]) => {
    if (value instanceof Blob) {
      acc.push(key);
    }
    return acc;
  }, []);

  const result = document.createElement('div');
  for (const item of contents.package.spine.itemref) {
    const idRef = item['@_idref'];
    const htmlHref = htmlMap[idRef] || '';
    // tslint:disable-next-line:no-non-null-assertion
    const regexResult = /.*<body[^>]*>((.|\s)+)<\/body>.*/.exec(data[htmlHref] as string)!;
    let innerHtml: string = regexResult[1];
    for (const blobKey of blobsAvailable) {
      innerHtml = innerHtml.replaceAll(relative(htmlHref, blobKey), buildDummyBookImage(blobKey));
    }
    const childDiv = document.createElement('div');
    childDiv.innerHTML = innerHtml;
    childDiv.id = `${prependValue}${idRef}`;
    result.appendChild(childDiv);
  }

  for (const tag of result.getElementsByTagName('a')) {
    const oldHref = tag.getAttribute('href');
    if (oldHref) {
      tag.setAttribute('href', '#' + oldHref.replace(/.+#/, ''));
    }
  }

  for (const tag of result.getElementsByTagName('image')) {
    if (!tag.getAttributeNames().some((x) => x === 'href')) {
      for (const attrName of tag.getAttributeNames()) {
        if (attrName.endsWith('href')) {
          // tslint:disable-next-line:no-non-null-assertion
          tag.setAttribute('href', tag.getAttribute(attrName)!);
        }
      }
    }
  }
  for (const tag of result.getElementsByTagName('svg')) {
    tag.removeAttribute('width');
    tag.removeAttribute('height');
  }
  clearBadImageRef(result);

  for (const childNode of childNodesAfterContents(result)) {
    const createWrapper = (tag: Element) => {
      const imgWrapper = document.createElement('span');
      imgWrapper.toggleAttribute('data-ttu-spoiler-img');
      const parentElement = tag.parentElement || childNode;
      parentElement.insertBefore(imgWrapper, tag);
      imgWrapper.appendChild(tag);
    };

    for (const tag of childNode.getElementsByTagName('img')) {
      if (![...tag.classList.values()].some((className) => className.includes('gaiji'))) {
        createWrapper(tag);
      }
    }

    for (const tag of childNode.getElementsByTagName('svg')) {
      if (tag.getElementsByTagName('image').length) {
        createWrapper(tag);
      }
    }
  }

  for (const tag of result.getElementsByTagName('br')) {
    const placeholderEl = document.createElement('span'); // for Firefox
    placeholderEl.classList.add('placeholder-br');
    placeholderEl.setAttribute('aria-hidden', 'true');
    placeholderEl.innerText = '〇';
    const parentElement = tag.parentElement || result;
    parentElement.insertBefore(placeholderEl, tag);
  }

  return result;
}

function relative(fromPath: string, toPath: string): string {
  const fromDirName = path.dirname(fromPath);
  const toDirName = path.dirname(toPath);
  const toFilename = path.basename(toPath);

  if (fromDirName === toDirName) {
    return toFilename;
  }

  const fromParts = fromDirName === '.' ? [] : fromDirName.split('/');
  const toParts = toDirName === '.' ? [] : toDirName.split('/');

  if (fromParts.length >= toParts.length) {
    for (let i = 0; i < fromParts.length; i += 1) {
      if (fromParts[i] !== toParts[i]) {
        return path.join('../'.repeat(fromParts.length - i) + toParts.slice(i).join('/'), toFilename);
      }
    }
  }
  for (let i = 0; i < fromParts.length; i += 1) {
    if (fromParts[i] !== toParts[i]) {
      return path.join('../'.repeat(fromParts.length - i) + toParts.slice(i).join('/'), toFilename);
    }
  }

  return path.join(toParts.slice(fromParts.length - toParts.length).join('/'), toFilename);
}

export function buildDummyBookImage(key: string) {
  return `data:image/gif;ttu:${key};base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==`;
}
