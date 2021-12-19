/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Converts attributes like xlink:href to href
 */
export default function fixXHtmlHref(el: HTMLElement) {
  for (const tag of el.getElementsByTagName('image')) {
    if (!tag.getAttributeNames().some((x) => x === 'href')) {
      for (const attrName of tag.getAttributeNames()) {
        if (attrName.endsWith('href')) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tag.setAttribute('href', tag.getAttribute(attrName)!);
        }
      }
    }
  }
}
