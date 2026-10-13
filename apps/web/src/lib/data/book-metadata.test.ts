/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  applyMetadata,
  cleanDescription,
  parseBookMetadata,
  parseJitenDecks
} from './book-metadata';
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

describe('applyMetadata', () => {
  it('replaces the cover only when one was saved', () => {
    const card = { title: 'a', imagePath: 'own.jpg' } as BookCardProps;
    const map = parseBookMetadata({ a: entry });

    expect(applyMetadata(card, map).imagePath).toBe(entry.cover);
    expect(applyMetadata(card, map).displayTitle).toBeUndefined();
    expect(applyMetadata(card, { a: { ...map.a, cover: '' } })).toBe(card);
  });

  it("shows VNDB's title", () => {
    const card = { title: 'game_folder', imagePath: 'own.jpg' } as BookCardProps;
    const map = parseBookMetadata({
      game_folder: { ...entry, source: 'vndb', url: 'https://vndb.org/v1', cover: '' }
    });

    expect(applyMetadata(card, map)).toEqual({ ...card, displayTitle: 'タイトル' });
  });
});

describe('parseJitenDecks', () => {
  const deck = {
    deckId: 233,
    mediaType: 7,
    parentDeckId: null,
    originalTitle: 'Fate/stay night',
    description: 'Text',
    coverName: 'https://cdn.jiten.moe/233/cover.jpg',
    genres: [1, 99],
    tags: [
      { name: 'Magic', percentage: 96 },
      { name: 'Rare', percentage: 10 }
    ],
    releaseDate: '2004-01-30T00:00:00',
    externalRating: 85
  };

  it('keeps decks of the kind and maps their fields', () => {
    const [candidate, ...rest] = parseJitenDecks(
      { data: [deck, { ...deck, deckId: 1, mediaType: 1 }, { ...deck, parentDeckId: 233 }] },
      'vn'
    );

    expect(rest).toEqual([]);
    expect(candidate).toEqual({
      source: 'jiten',
      url: 'https://jiten.moe/decks/media/233/detail',
      title: 'Fate/stay night',
      description: 'Text',
      cover: deck.coverName,
      genres: ['Action', 'Magic'],
      released: '2004-01-30',
      score: 85
    });
    expect(parseBookMetadata({ a: { ...candidate, modified: 1 } }).a.cover).toBe(deck.coverName);
  });
});
