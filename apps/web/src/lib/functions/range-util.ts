/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { getParagraphNodes } from '$lib/components/book-reader/get-paragraph-nodes';

export function getParagraphToPoint(x: number, y: number) {
  const element = document.elementFromPoint(x, y)?.closest('p');

  if (!element) {
    return undefined;
  }

  const nodes = getParagraphNodes(element);

  if (!nodes.length) {
    return undefined;
  }

  return { range: createRange(nodes[0]), parent: element };
}

export function createRange(node: Node, startOffset = 0, endOffset = 0) {
  const range = new Range();
  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);

  return range;
}

export function getRangeForUserSelection(window: Window, preSelection: Range | undefined) {
  const currentSelection = window.getSelection()?.toString().trim()
    ? window.getSelection()?.getRangeAt(0)
    : undefined;

  let userSelection: Range | undefined;

  if (currentSelection) {
    userSelection = currentSelection;
  } else {
    userSelection = preSelection;
  }

  if (!userSelection) {
    return undefined;
  }

  const nextParagraph = userSelection.endContainer.parentElement?.closest('p');

  if (!nextParagraph) {
    return undefined;
  }

  const nodes = getParagraphNodes(nextParagraph);

  if (!nodes.length) {
    return undefined;
  }

  return createRange(nodes[0]);
}

export function getNodeBoundingRect(document: Document, node: Node) {
  const range = document.createRange();
  range.selectNode(node);
  return range.getBoundingClientRect();
}

export function clearRange(window: Window, timeout = 250) {
  window.getSelection()?.removeAllRanges();

  setTimeout(() => {
    window.getSelection()?.addRange(new Range());
  }, timeout);
}

export function getReferencePoints(
  window: Window,
  element: Element,
  verticalMode: boolean,
  firstDimensionMarginValue: number,
  bottomGap = 0
) {
  const firstDimensionMargin = Math.min(
    Math.max(firstDimensionMarginValue, 0),
    verticalMode ? window.innerWidth / 4 : window.innerHeight / 4
  );
  const rect = element.getBoundingClientRect();
  const elLeftReferencePoint = verticalMode ? firstDimensionMargin : rect.left;
  const elRightReferencePoint = verticalMode
    ? window.innerWidth - firstDimensionMargin
    : rect.right;
  const elTopReferencePoint = verticalMode ? rect.top : firstDimensionMargin;
  const elBottomReferencePoint = verticalMode
    ? rect.bottom
    : window.innerHeight - firstDimensionMargin - bottomGap;
  const pointGap = Number(getComputedStyle(element).lineHeight.replace(/px$/, ''));

  return {
    elLeftReferencePoint,
    elRightReferencePoint,
    elTopReferencePoint,
    elBottomReferencePoint,
    firstDimensionMargin,
    pointGap
  };
}

export function pulseElement(
  element: HTMLElement | undefined | null,
  action: 'add' | 'remove',
  duration: number,
  timeout = 0
) {
  if (!element) {
    return;
  }

  const cssClass = `animate-[pulse_${duration}s_cubic-bezier(0.4,0,0.6,1)_${
    timeout ? '1' : 'infinite'
  }]`;

  element.classList[action](cssClass);

  if (timeout) {
    setTimeout(() => element.classList.remove(cssClass), timeout);
  }
}
