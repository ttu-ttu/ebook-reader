/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Kanji met while reading, per book, counted from the text up to the reading
 * position, for the library's Home tab. Kept in this browser only. Not part of upstream.
 */

import { readerDb } from '$lib/data/reader-db';
import { textBetween } from '$lib/data/recap';
import type { SearchIndex } from '$lib/functions/book-text/book-search';

export interface KanjiSeen {
  title: string;
  /** Character count counted up to */
  upTo: number;
  counts: Record<string, number>;
}

const kanjiPattern = /\p{Unified_Ideograph}/gu;
/** A forward jump larger than this (e.g. "Jump to position") isn't counted as read. */
const maxStep = 20_000;

export function countKanji(text: string, counts: Record<string, number> = {}) {
  for (const [kanji] of text.matchAll(kanjiPattern)) {
    counts[kanji] = (counts[kanji] ?? 0) + 1;
  }

  return counts;
}

/**
 * Adds the kanji between the last recorded position and `position`. The first
 * time a book is recorded, everything before the position counts as read.
 */
export async function recordKanjiSeen(title: string, index: SearchIndex, position: number) {
  const db = await readerDb();
  const seen = (await db.get('kanji', title)) ?? { title, upTo: 0, counts: {} };

  if (position <= seen.upTo) {
    return;
  }

  if (!seen.upTo || position - seen.upTo <= maxStep) {
    countKanji(textBetween(index, seen.upTo, position), seen.counts);
  }

  await db.put('kanji', { ...seen, upTo: position });
}

export interface KanjiSummary {
  /** Different kanji met across all books */
  unique: number;
}

export function summarizeKanji(books: KanjiSeen[]): KanjiSummary {
  return { unique: new Set(books.flatMap((book) => Object.keys(book.counts))).size };
}

export async function getKanjiSummary() {
  return summarizeKanji(await (await readerDb()).getAll('kanji'));
}

export interface KanjiCoverage {
  /** Share of the book's kanji occurrences already met, 0-1 */
  coverage: number;
  /** Different kanji in the book not met yet */
  newKanji: number;
}

/** How much of a book's kanji (its counts from the difficulty service) a reader has met. */
export function kanjiCoverage(
  bookCounts: Record<string, number>,
  books: KanjiSeen[]
): KanjiCoverage | undefined {
  const met = new Set(books.flatMap((book) => Object.keys(book.counts)));
  let total = 0;
  let known = 0;
  let newKanji = 0;

  for (const [kanji, count] of Object.entries(bookCounts)) {
    total += count;
    if (met.has(kanji)) {
      known += count;
    } else {
      newKanji += 1;
    }
  }

  return total ? { coverage: known / total, newKanji } : undefined;
}

export async function getKanjiSeen() {
  return (await readerDb()).getAll('kanji');
}
