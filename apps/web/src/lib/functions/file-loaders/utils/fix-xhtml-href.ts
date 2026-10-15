/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Converts attributes like xlink:href to href
 */
export default function fixXHtmlHref(el: HTMLElement) {
  Array.from(el.getElementsByTagName('image'))
    .filter((tag) => !tag.getAttributeNames().some((x) => x === 'href'))
    .forEach((tag) => {
      const attr = Array.from(tag.attributes).find((a) => a.name.endsWith('href'));
      if (!attr) return;

      tag.setAttribute('href', attr.value);
    });
}
