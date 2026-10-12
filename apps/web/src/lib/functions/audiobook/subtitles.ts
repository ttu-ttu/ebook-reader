/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * SRT/VTT subtitles of an audiobook (e.g. from Whisper) and their alignment with
 * the book text, so playback can highlight and follow the line being read, like
 * ttu-whispersync but without a userscript. Not part of upstream.
 */

import { gaijiPlaceholder } from '$lib/functions/book-text/text-positions';
import { isCountedCharacter } from '$lib/functions/get-character-count';

export interface SubtitleCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface MatchedCue extends SubtitleCue {
  /** Character counts in the book (as bookmarks), or undefined if the line was not found */
  start?: number;
  end?: number;
}

const timePattern =
  /((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)/;

function parseTime(time: string) {
  return time
    .replace(',', '.')
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0);
}

/** Cues of an SRT or WebVTT file, in file order. */
export function parseSubtitles(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  content
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .forEach((block) => {
      const lines = block.split('\n');
      const timeIndex = lines.findIndex((line) => timePattern.test(line));

      if (timeIndex < 0) {
        return;
      }

      const [, start, end] = lines[timeIndex].match(timePattern)!;
      const text = lines
        .slice(timeIndex + 1)
        .join(' ')
        .replace(/<[^>]*>|\{\\[^}]*\}/g, '')
        .trim();

      if (text) {
        cues.push({ startSeconds: parseTime(start), endSeconds: parseTime(end), text });
      }
    });

  return cues;
}

/**
 * Only the characters that count for bookmarks, with katakana folded to
 * hiragana and full-width letters to ASCII, so an index in the text of a whole
 * book is its character count.
 */
export function matchableText(text: string) {
  let result = '';

  for (const char of text) {
    if (char !== gaijiPlaceholder && !isCountedCharacter(char)) {
      continue;
    }

    let code = char.codePointAt(0)!;

    if (code >= 0xff01 && code <= 0xff5e) {
      code -= 0xfee0;
    } else if (code >= 0x30a1 && code <= 0x30f6) {
      code -= 0x60;
    }

    result += String.fromCodePoint(code).toLowerCase();
  }

  return result;
}

function gramIndex(text: string) {
  const index = new Map<string, number[]>();
  const chars = Array.from(text);

  for (let i = 0; i + 3 <= chars.length; i += 1) {
    const gram = chars[i] + chars[i + 1] + chars[i + 2];
    const positions = index.get(gram);

    if (positions) {
      positions.push(i);
    } else {
      index.set(gram, [i]);
    }
  }

  return index;
}

function firstAtLeast(positions: number[], value: number) {
  let low = 0;
  let high = positions.length;

  while (low < high) {
    const middle = (low + high) >> 1;

    if (positions[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

const minWindow = 3000;
const maxWindow = 60_000;

/**
 * Finds each cue in the book text, in order, from `startCount`. A cue that
 * isn't found exactly is placed where most of its three-character pieces agree
 * (transcripts often get a kanji or two wrong). Lines that can't be placed are
 * filled in between their neighbours when the gap is small.
 *
 * `bookText` is `matchableText` of the whole book (code points, so emoji or
 * rare kanji outside the BMP keep counts aligned).
 */
export function matchCues(cues: SubtitleCue[], bookText: string, startCount = 0): MatchedCue[] {
  const book = Array.from(bookText);
  const grams = gramIndex(bookText);
  const result: MatchedCue[] = cues.map((cue) => ({ ...cue }));
  let cursor = startCount;
  let misses = 0;

  result.forEach((cue) => {
    const text = Array.from(matchableText(cue.text));

    if (!text.length) {
      return;
    }

    const window = Math.min(
      maxWindow,
      Math.max(minWindow, text.length * 20) * 2 ** Math.min(misses, 5)
    );
    const limit = cursor + window;
    const exact = book.indexOf(text[0], cursor);
    let found = -1;

    // Exact match first (cheap and the common case for short lines).
    for (let at = exact; at >= 0 && at < limit; at = book.indexOf(text[0], at + 1)) {
      if (text.every((char, i) => book[at + i] === char)) {
        found = at;
        break;
      }
    }

    let end = found + text.length;

    if (found < 0 && text.length >= 3) {
      const votes = new Map<number, number>();
      const gramPositions = (i: number) => grams.get(text[i] + text[i + 1] + text[i + 2]) ?? [];

      for (let i = 0; i + 3 <= text.length; i += 1) {
        const positions = gramPositions(i);

        for (let p = firstAtLeast(positions, cursor + i); p < positions.length; p += 1) {
          if (positions[p] - i >= limit) {
            break;
          }
          const offset = positions[p] - i;

          votes.set(offset, (votes.get(offset) ?? 0) + 1);
        }
      }

      let best = -1;
      let bestVotes = 0;

      // Insertions and deletions shift the offset slightly, so neighbours count too.
      votes.forEach((_, offset) => {
        let total = 0;

        for (let d = -3; d <= 3; d += 1) {
          total += votes.get(offset + d) ?? 0;
        }
        if (total > bestVotes || (total === bestVotes && offset < best)) {
          best = offset;
          bestVotes = total;
        }
      });

      if (bestVotes >= Math.max(2, (text.length - 2) * 0.3)) {
        // The line runs from its first to its last piece found near that offset.
        for (let i = 0; i + 3 <= text.length; i += 1) {
          const positions = gramPositions(i);
          const p = positions[firstAtLeast(positions, Math.max(cursor, best - 3) + i)];

          if (p !== undefined && p - i <= best + 3) {
            if (found < 0) {
              found = p - i;
            }
            end = p + text.length - i;
          }
        }
      }
    }

    if (found < 0) {
      misses += 1;
      return;
    }

    misses = 0;
    cue.start = found;
    cue.end = Math.min(end, book.length);
    // A little slack, in case the line was placed a character or two too long.
    cursor = Math.max(found + 1, cue.end - 5);
  });

  // Fill short gaps between found lines.
  result.forEach((cue, i) => {
    if (cue.start !== undefined) {
      return;
    }

    const previous = result
      .slice(0, i)
      .reverse()
      .find((c) => c.end !== undefined);
    const next = result.slice(i + 1).find((c) => c.start !== undefined);

    if (
      previous?.end !== undefined &&
      next?.start !== undefined &&
      next.start - previous.end < 500
    ) {
      cue.start = previous.end;
      cue.end = Math.max(next.start, previous.end);
    }
  });

  return result;
}

/** Index of the cue playing at `seconds` (the last one started), or -1. */
export function cueAt(cues: SubtitleCue[], seconds: number) {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;

    if (cues[middle].startSeconds <= seconds) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return found;
}
