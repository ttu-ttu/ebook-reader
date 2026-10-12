/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Plain-text paragraphs of a book from a character position, for text-to-speech.
 * Furigana is dropped, except katakana readings, which replace their base text
 * when spoken (see `speechText`). Not part of upstream.
 */

import { getParagraphs } from '$lib/functions/book-text/book-search';
import { gaijiPlaceholder } from '$lib/functions/book-text/text-positions';
import { countTextCharacters } from '$lib/functions/get-character-count';

export interface ReadingParagraph {
  text: string;
  /** Character count (as used for bookmarks) at the start of the paragraph */
  startCharCount: number;
}

// Katakana readings are kept in the text as uncounted private-use characters,
// `readingStart` base `readingMark` encoded reading `readingEnd`, so character
// counts (bookmarks, highlight) stay those of the base text.
const readingStart = '\uE001';
const readingMark = '\uE002';
const readingEnd = '\uE003';
const encodedKanaOffset = 0xe100 - 0x30a0;
const katakanaRegex = /^[\u30a0-\u30ff]+$/;
const readingRegex = /\uE001([^\uE002]*)\uE002([^\uE003]*)\uE003/g;

function shiftCodes(text: string, offset: number) {
  return String.fromCharCode(...Array.from(text, (char) => char.charCodeAt(0) + offset));
}

function markKatakanaReadings(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('ruby > rt').forEach((rt) => {
    const reading = rt.textContent?.trim() || '';

    if (!katakanaRegex.test(reading)) {
      return;
    }

    // The base is everything since the previous <rt> of the same ruby.
    let first: ChildNode = rt;

    while (first.previousSibling && first.previousSibling.nodeName !== 'RT') {
      first = first.previousSibling;
    }
    if (first === rt) {
      return;
    }
    first.before(readingStart);
    rt.before(readingMark + shiftCodes(reading, encodedKanaOffset) + readingEnd);
  });

  return doc.body.innerHTML;
}

/** Chunk text as sent to the voice: katakana readings instead of their base text. */
export function speechText(text: string) {
  return text
    .replace(readingRegex, (_, base, reading) => shiftCodes(reading, -encodedKanaOffset))
    .replace(/[\uE001-\uE003]/g, '');
}

/** Chunk text as shown, without the readings. */
export function displayReadingText(text: string) {
  return text.replace(readingRegex, '$1').replace(/[\uE001-\uE003]/g, '');
}

export function extractParagraphsFrom(elementHtml: string, startCharCount: number) {
  const paragraphs = getParagraphs(markKatakanaReadings(elementHtml));

  // Start with the paragraph that contains the current position.
  return paragraphs
    .filter((paragraph, index) => {
      const next = paragraphs[index + 1];

      return !next || next.startCount > startCharCount;
    })
    .map(
      (paragraph): ReadingParagraph => ({
        text: paragraph.text.replaceAll(gaijiPlaceholder, '').replace(/\s+/g, ' ').trim(),
        startCharCount: paragraph.startCount
      })
    )
    .filter((paragraph) => paragraph.text);
}

const minChunkLength = 200;
const maxChunkLength = 800;

/** Merge short paragraphs and split long ones so each request is a reasonable size. */
export function buildReadingChunks(paragraphs: ReadingParagraph[]) {
  const result: ReadingParagraph[] = [];

  for (const paragraph of paragraphs) {
    const sentences = paragraph.text.match(/[^。！？!?]+[。！？!?」』）]*|[^。！？!?]+$/g) || [
      paragraph.text
    ];

    // Counted characters before each sentence, so the page can follow the voice
    // within long paragraphs (gaiji were dropped from the text, so this can lag slightly).
    let countInParagraph = 0;

    sentences.forEach((sentence, sentenceIndex) => {
      const last = result[result.length - 1];
      const startsParagraph = sentenceIndex === 0;
      const startCharCount = paragraph.startCharCount + countInParagraph;

      countInParagraph += countTextCharacters(sentence);

      if (
        last &&
        last.text.length + sentence.length <= maxChunkLength &&
        (last.text.length < minChunkLength || !startsParagraph)
      ) {
        last.text += startsParagraph ? `\n${sentence}` : sentence;
      } else {
        result.push({ text: sentence, startCharCount });
      }
    });
  }

  return result;
}
