/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
import buildDummyBookImage from '../file-loaders/utils/build-dummy-book-image';
import { isElementGaiji } from '../is-element-gaiji';

export default function formatBookDataHtml(bookData: BooksDbBookData, document: Document) {
  return getHtmlWithImageSource(bookData).pipe(
    map((elementHtml) => {
      const element = document.createElement('div');
      element.innerHTML = elementHtml;

      addImageContainerClass(element);
      // combineImagePairs(element);
      removeSvgDimensions(element);
      addSpoilerTags(element, document);
      removeOldBrTagSolution(element);

      return element.innerHTML;
    })
  );
}

function getHtmlWithImageSource(bookData: BooksDbBookData) {
  return new Observable<string>((subscriber) => {
    const { blobs } = bookData;

    let { elementHtml } = bookData;
    const objectUrls: string[] = [];
    Object.entries(blobs).forEach(([key, value]) => {
      const url = URL.createObjectURL(value);
      objectUrls.push(url);
      elementHtml = elementHtml
        .replaceAll(buildDummyBookImage(key), url)
        .replaceAll(`ttu:${key}`, url);
    });
    subscriber.next(elementHtml);

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  });
}

function addImageContainerClass(el: HTMLElement) {
  Array.from(el.getElementsByTagName('img'))
    .map((imgEl) => ({ parentEl: imgEl.parentElement, isGaiji: isElementGaiji(imgEl) }))
    .forEach(({ parentEl, isGaiji }) => {
      parentEl?.classList.add('ttu-img-container');

      if (!isGaiji) {
        parentEl?.classList.add('ttu-illustration-container');
      }
    });
}

function removeSvgDimensions(el: HTMLElement) {
  Array.from(el.getElementsByTagName('svg')).forEach((tag) => {
    tag.removeAttribute('width');
    tag.removeAttribute('height');
  });
}

function addSpoilerTags(el: HTMLElement, document: Document) {
  const getChildNodesAfterTableOfContents = () => {
    let childNodes = [...el.children];
    const afterContentsDivIndex =
      childNodes.findIndex((childNode) => childNode.getElementsByTagName('a').length > 1) + 1;
    if (afterContentsDivIndex > 0 && afterContentsDivIndex < childNodes.length) {
      childNodes = childNodes.slice(afterContentsDivIndex);
    }
    return childNodes;
  };

  const createWrapper = (tag: Element, childNode: Element) => {
    const imgWrapper = document.createElement('span');
    imgWrapper.toggleAttribute('data-ttu-spoiler-img');
    const parentElement = tag.parentElement || childNode;
    parentElement.insertBefore(imgWrapper, tag);
    imgWrapper.appendChild(tag);
  };

  getChildNodesAfterTableOfContents().forEach((childNode) => {
    Array.from(childNode.getElementsByTagName('img'))
      .filter((tag) => !isElementGaiji(tag))
      .forEach((tag) => createWrapper(tag, childNode));

    Array.from(childNode.getElementsByTagName('svg'))
      .filter((tag) => tag.getElementsByTagName('image').length)
      .forEach((tag) => createWrapper(tag, childNode));
  });
}

function removeOldBrTagSolution(el: HTMLElement) {
  el.querySelectorAll('.placeholder-br').forEach((placeholderEl) => {
    placeholderEl.parentElement!.removeChild(placeholderEl);
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function combineImagePairs(el: HTMLElement) {
  const imagePairs: [Element, Element][] = [];

  let startingIndex = 1;

  if (el.children.item(0)?.id.startsWith('ttu-')) {
    // Skip first page (index 0) as it's probably cover
    startingIndex = 2;
  }

  for (let i = startingIndex; i < el.children.length; i += 2) {
    const leftChild = el.children.item(i - 1)!;
    const rightChild = el.children.item(i)!;

    if (
      hasNoText(leftChild) &&
      hasNoText(rightChild) &&
      hasSingleImage(leftChild) &&
      hasSingleImage(rightChild)
    ) {
      imagePairs.push([leftChild, rightChild]);
    }
  }

  if (
    imagePairs.some(([leftPair, rightPair]) => {
      const leftImages = leftPair.querySelectorAll('image');
      const rightImages = rightPair.querySelectorAll('image');

      if (leftImages.length !== 1 || rightImages.length !== 1) {
        // Not supported
        return true;
      }

      if (!isImagePortrait(leftImages[0]) || !isImagePortrait(rightImages[0])) {
        return true;
      }

      return false;
    })
  ) {
    return;
  }

  imagePairs.forEach(([leftPair, rightPair]) => {
    el.removeChild(rightPair);

    leftPair.classList.add('grouped-image');

    const images = extractImageChildren(leftPair).concat(extractImageChildren(rightPair));

    clearChildren(leftPair);

    images.forEach((image) => leftPair.appendChild(image));
  });
}

function hasNoText(el: Element) {
  return typeof el.textContent === 'string' ? el.textContent.trim().length === 0 : !el.textContent;
}

function getImageChildren(el: Element) {
  const imageChilds = el.querySelectorAll('svg');
  return imageChilds;
}

function hasSingleImage(el: Element) {
  return getImageChildren(el).length === 1;
}

function extractImageChildren(el: Element) {
  const imageChildren = getImageChildren(el);
  const result: Element[] = [];
  imageChildren.forEach((child) => {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
      result.push(child);
    }
  });
  return result;
}

function clearChildren(el: Element) {
  Array.from(el.children).forEach((child) => {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
  });
  return el;
}

function isImagePortrait(el: SVGImageElement) {
  return el.height.baseVal.value > el.width.baseVal.value;
}
