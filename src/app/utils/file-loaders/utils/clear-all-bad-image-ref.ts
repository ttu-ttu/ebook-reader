/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Clear all references that aren't packed, which could be caused by:
 * - Bad input file (doesn't include the required image)
 * - Bad image file extension
 */
export default function clearAllBadImageRef(el: HTMLElement) {
  const clearTagBadImageAttribute = (tag: Element, attributeName: string) => {
    const attr = tag.getAttribute(attributeName);
    if (
      attr &&
      !(attr.startsWith('ttu:') || attr.startsWith('data:image/gif;ttu:'))
    ) {
      tag.setAttribute(`data-ttu-${attributeName}`, attr);
      tag.removeAttribute(attributeName);
    }
  };

  for (const tag of el.getElementsByTagName('image')) {
    clearTagBadImageAttribute(tag, 'href');
  }
  for (const tag of el.getElementsByTagName('img')) {
    clearTagBadImageAttribute(tag, 'src');
  }
}
