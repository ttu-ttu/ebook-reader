/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { parseBookHtml } from './sanitize-book-html';

const clean = (html: string) => parseBookHtml(html).innerHTML;

describe('parseBookHtml', () => {
  it('keeps ordinary book markup', () => {
    const html =
      '<p class="a" id="p1">本<ruby>漢字<rt>かんじ</rt></ruby></p>' +
      '<img src="data:image/gif;ttu:OEBPS/a.png;base64,R0lGOD" alt="">' +
      '<a href="#note1">1</a><svg><image xlink:href="data:image/gif;ttu:b.jpg;base64,R0"></image></svg>';

    const result = parseBookHtml(html);

    expect(result.querySelector('rt')?.textContent).toBe('かんじ');
    expect(result.querySelector('img')?.getAttribute('src')).toContain('ttu:OEBPS/a.png');
    expect(result.querySelector('a')?.getAttribute('href')).toBe('#note1');
    expect(result.querySelector('image')?.getAttribute('xlink:href')).toContain('ttu:b.jpg');
    expect(result.querySelector('#p1')).not.toBeNull();
  });

  it('removes event handlers, script and embedding elements', () => {
    const result = clean(
      '<img src="x" onerror="alert(1)"><svg onload="alert(1)"><script>alert(1)</script></svg>' +
        '<p OnMouseOver="alert(1)">t</p><script>alert(1)</script><iframe srcdoc="x"></iframe>' +
        '<object data="x"></object><embed src="x"><base href="https://evil/"><meta http-equiv="refresh">' +
        '<form action="https://evil/"><input></form>'
    );

    expect(result).not.toMatch(
      /onerror|onload|onmouseover|<script|<iframe|<object|<embed|<base|<meta|<form/i
    );
    expect(result).toContain('<p>t</p>');
  });

  it('removes javascript:, vbscript: and non-image data: URLs, also when obfuscated', () => {
    const result = parseBookHtml(
      '<a id="a" href="javascript:alert(1)">a</a>' +
        '<a id="b" href=" java\tscript:alert(1)">b</a>' +
        '<a id="c" href="JaVaScRiPt:alert(1)">c</a>' +
        '<a id="d" href="data:text/html,<script>alert(1)</script>">d</a>' +
        '<a id="e" href="vbscript:x">e</a>' +
        '<svg><a id="f" xlink:href="javascript:alert(1)"><text>f</text></a></svg>' +
        '<a id="g" href="https://example.com/">g</a>'
    );

    for (const id of 'abcdef') {
      const link = result.querySelector(`#${id}`)!;
      expect(link.getAttribute('href') ?? link.getAttribute('xlink:href'), id).toBeNull();
    }
    expect(result.querySelector('#g')?.getAttribute('href')).toBe('https://example.com/');
  });

  it('removes SVG animation that could set a javascript: link', () => {
    expect(
      clean(
        '<svg><a><animate attributeName="href" to="javascript:alert(1)"/><text>x</text></a></svg>'
      )
    ).not.toContain('animate');
  });

  it("doesn't let markup hidden in noscript survive a second parse", () => {
    // With scripting on, noscript content is raw text up to "</noscript>", so the
    // attribute below would turn into a live <img onerror> when re-parsed.
    const result = clean(
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></p></noscript>'
    );
    const reparsed = document.createElement('div');

    reparsed.innerHTML = result;

    expect(reparsed.querySelector('[onerror]')).toBeNull();
    expect(result).not.toContain('noscript');
  });

  it('runs nothing while parsing', () => {
    const fired: string[] = [];

    (window as any).__fired = fired;
    parseBookHtml('<img src="x" onerror="window.__fired.push(1)">');

    expect(fired).toEqual([]);
  });
});
