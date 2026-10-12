/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Full-text search inside a book. Not part of upstream.
 *
 * The book HTML is indexed once into one string per paragraph (furigana left
 * out), so matches never span paragraphs. Each match records the character
 * count where it starts, which the reader can jump to like a bookmark.
 */

import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';
import {
  countCharacters,
  gaijiPlaceholder,
  getTextSegments
} from '$lib/functions/book-text/text-positions';

const blockSelector = 'p, div, li, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, td, th';

export interface Paragraph {
  /** Text without furigana; gaiji images are `gaijiPlaceholder` */
  text: string;
  /** Character count at the start of the paragraph */
  startCount: number;
}

export interface SearchIndex {
  paragraphs: Paragraph[];
}

export interface SearchOptions {
  /** Treat hiragana and katakana as the same */
  ignoreKana: boolean;
  /** Search with a regular expression */
  regex: boolean;
}

export interface SearchResult {
  /** Character counts before and at the end of the match */
  start: number;
  end: number;
  before: string;
  match: string;
  after: string;
  chapter: string;
}

export const maxSearchResults = 1000;

/** Paragraphs of the book HTML with their character counts. Also used by read aloud and recaps. */
export function getParagraphs(htmlContent: string): Paragraph[] {
  const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
  const paragraphs: Paragraph[] = [];

  // Ruby parentheses would split words like 漢(かん)字; <rt> is already skipped.
  doc.querySelectorAll('rp').forEach((rp) => rp.remove());

  let currentBlock: Element | null = null;
  let current: Paragraph | undefined;

  getTextSegments(doc.body).forEach((segment) => {
    const block = segment.node.parentElement?.closest(blockSelector) || null;

    if (!current || block !== currentBlock) {
      current = { text: '', startCount: segment.startCount };
      currentBlock = block;
      paragraphs.push(current);
    }

    current.text += segment.text;
  });

  return paragraphs;
}

export function buildSearchIndex(htmlContent: string): SearchIndex {
  return { paragraphs: getParagraphs(htmlContent) };
}

/** Paragraph text for display or for sending elsewhere. */
export function displayText(text: string) {
  return text.replaceAll(gaijiPlaceholder, '〓');
}

/**
 * Same-length normalisation, so offsets in the normalised text match the
 * original. Regular expressions only get the kana folding, since width and case
 * changes would alter the pattern (e.g. \D).
 */
function normalize(text: string, ignoreKana: boolean, foldWidthAndCase = true) {
  let result = '';

  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);

    // Full-width ASCII → ASCII
    if (foldWidthAndCase && code >= 0xff01 && code <= 0xff5e) {
      code -= 0xfee0;
    }
    // Katakana → hiragana
    if (ignoreKana && code >= 0x30a1 && code <= 0x30f6) {
      code -= 0x60;
    }

    const char = String.fromCharCode(code);
    const lower = foldWidthAndCase ? char.toLowerCase() : char;

    result += lower.length === 1 ? lower : char;
  }

  return result;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Label of the chapter at a character count; untitled subsections use their parent's label. */
export function chapterLabelAt(sections: Section[], count: number) {
  let label = '';

  sections.forEach((section) => {
    if ((section.startCharacter ?? Infinity) <= count) {
      const parent = section.parentChapter
        ? sections.find((s) => s.reference === section.parentChapter)
        : undefined;

      label = section.label || parent?.label || label;
    }
  });

  return label;
}

/** Throws a SyntaxError for an invalid regular expression. */
export function searchBook(
  index: SearchIndex,
  query: string,
  options: SearchOptions,
  sections: Section[]
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const pattern = options.regex
    ? new RegExp(normalize(query, options.ignoreKana, false), 'giu')
    : new RegExp(escapeRegExp(normalize(query, options.ignoreKana)), 'gu');
  const results: SearchResult[] = [];

  for (let p = 0; p < index.paragraphs.length && results.length < maxSearchResults; p += 1) {
    const paragraph = index.paragraphs[p];
    const haystack = normalize(paragraph.text, options.ignoreKana, !options.regex);

    pattern.lastIndex = 0;

    let match = pattern.exec(haystack);

    while (match && results.length < maxSearchResults) {
      if (!match[0].length) {
        pattern.lastIndex += 1;
      } else {
        const from = match.index;
        const to = from + match[0].length;
        const start = paragraph.startCount + countCharacters(paragraph.text.slice(0, from));

        results.push({
          start,
          end: start + countCharacters(paragraph.text.slice(from, to)),
          before: displayText(paragraph.text.slice(Math.max(0, from - 24), from)),
          match: displayText(paragraph.text.slice(from, to)),
          after: displayText(paragraph.text.slice(to, to + 24)),
          chapter: chapterLabelAt(sections, start)
        });
      }

      match = pattern.exec(haystack);
    }
  }

  return results;
}
