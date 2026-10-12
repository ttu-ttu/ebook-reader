/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Not part of upstream. Book HTML comes from EPUB files and from the shared sync folder,
 * which other people can write, so it must not run script in the reader. It is
 * parsed in an inert document (nothing loads, no handler fires) and cleaned
 * before it reaches the page. The Content-Security-Policy in svelte.config.js
 * is the second line of defence.
 */

/**
 * Elements that run code, load other documents, change how links resolve, or
 * parse differently once scripting is on (noscript & co. are the classic way to
 * smuggle markup past a sanitizer).
 */
const blockedElements = new Set([
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',
  'base',
  'meta',
  'link',
  'form',
  'template',
  'noscript',
  'noembed',
  'noframes',
  'xmp',
  'plaintext',
  // SVG animation can set href to a javascript: URL.
  'animate',
  'set'
]);

const urlAttributes = new Set([
  'href',
  'xlink:href',
  'src',
  'action',
  'formaction',
  'data',
  'poster',
  'background',
  'lowsrc',
  'dynsrc'
]);

// Browsers ignore whitespace and control characters inside the scheme ("java\tscript:").
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const ignoredUrlCharacters = /[\u0000- \u007f-\u009f]/g;
const unsafeUrl = /^(?:javascript:|vbscript:|data:(?!image\/))/i;

/** A document without a browsing context: parsing into it loads nothing and runs nothing. */
export function createInertDocument() {
  return new DOMParser().parseFromString('<!doctype html><title></title>', 'text/html');
}

/** Removes everything under `root` that could run script, in place. */
export function sanitizeBookElement(root: Element) {
  for (const element of [...root.querySelectorAll('*')]) {
    if (blockedElements.has(element.localName.toLowerCase())) {
      element.remove();
      continue;
    }

    for (const { name, value } of [...element.attributes]) {
      const lowerName = name.toLowerCase();

      if (
        lowerName.startsWith('on') ||
        lowerName === 'srcdoc' ||
        (urlAttributes.has(lowerName) && unsafeUrl.test(value.replace(ignoredUrlCharacters, '')))
      ) {
        element.removeAttribute(name);
      }
    }
  }
}

/** Book HTML as a cleaned element of an inert document. */
export function parseBookHtml(html: string) {
  const element = createInertDocument().createElement('div');

  element.innerHTML = html;
  sanitizeBookElement(element);

  return element;
}
