/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { applyMetadataCover, cleanDescription, parseBookMetadata } from './book-metadata';
import type { BookCardProps } from '$lib/components/book-card/book-card-props';

const entry = {
  source: 'anilist',
  url: 'https://anilist.co/manga/1',
  title: 'タイトル',
  description: 'Text',
  cover: 'https://s4.anilist.co/file/cover.jpg',
  genres: ['Drama', 3],
  released: '2001-02-03',
  score: 80,
  modified: 1
};

describe('parseBookMetadata', () => {
  it('keeps entries linking to the sources', () => {
    const map = parseBookMetadata({ a: entry });

    expect(map.a.cover).toBe(entry.cover);
    expect(map.a.genres).toEqual(['Drama']);
  });

  it('drops foreign pages and covers', () => {
    const map = parseBookMetadata({
      a: { ...entry, cover: 'https://evil.example/x.jpg' },
      b: { ...entry, url: 'javascript:alert(1)' },
      c: { ...entry, source: 'other' }
    });

    expect(map.a.cover).toBe('');
    expect(Object.keys(map)).toEqual(['a']);
  });

  it('ignores non-objects', () => {
    expect(parseBookMetadata([entry])).toEqual({});
    expect(parseBookMetadata(null)).toEqual({});
  });
});

describe('cleanDescription', () => {
  it('strips markup and spoilers', () => {
    expect(
      cleanDescription(
        'A<br><br>\n<i>B</i> &amp; [url=/c1]C[/url] ~!secret!~[spoiler]x[/spoiler]<img src=x>'
      )
    ).toBe('A\n\nB & C');
  });
});

describe('applyMetadataCover', () => {
  it('replaces the cover only when one was saved', () => {
    const card = { title: 'a', imagePath: 'own.jpg' } as BookCardProps;
    const map = parseBookMetadata({ a: entry });

    expect(applyMetadataCover(card, map).imagePath).toBe(entry.cover);
    expect(applyMetadataCover(card, { a: { ...map.a, cover: '' } })).toBe(card);
  });
});
