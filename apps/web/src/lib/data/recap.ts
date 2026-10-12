/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * "Story so far" recaps: each finished chapter is summarised once (cached in
 * the browser), then a recap is written from those summaries and the text just
 * before the reading position. Nothing past the position is sent. Not part of upstream.
 */

import { openRouterModel$, openRouterRecapModel$ } from '$lib/data/ai-settings';
import { aiPrompts } from '$lib/data/ai-prompts';
import { askAi } from '$lib/data/ask-ai';
import { readerDb } from '$lib/data/reader-db';
import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';
import { displayText, type SearchIndex } from '$lib/functions/book-text/book-search';
import { offsetForCount } from '$lib/functions/book-text/text-positions';
import { Subject } from 'rxjs';

const chunkCharacters = 40_000;
const maxChapterText = 50_000;
const recentText = 4000;

/** A written recap, kept so earlier ones can be read again. */
export interface SavedRecap {
  /** Character count the recap covers up to */
  position: number;
  text: string;
  created: number;
  model: string;
}

/** Cached "Story so far" chapter summaries, keyed by chapter reference, and the saved recaps. */
export interface BookRecaps {
  title: string;
  chapters: Record<string, { summary: string; characters: number; model: string }>;
  saved?: SavedRecap[];
  /** `created` of deleted saved recaps, so the deletion syncs */
  deletedSaved?: number[];
  /** Account the browser copy belongs to ('' signed out); set by extras-sync.ts */
  account?: string;
}

/** Emits after every local change (extras-sync.ts uploads it). */
export const recapsChanged$ = new Subject<BookRecaps>();

/**
 * Two copies of a book's recaps: chapter summaries and saved recaps from both
 * (local wins for the same chapter), minus deleted recaps.
 */
export function mergeRecaps(title: string, local?: BookRecaps, remote?: BookRecaps): BookRecaps {
  const deleted = [...new Set([...(local?.deletedSaved ?? []), ...(remote?.deletedSaved ?? [])])];
  const saved = new Map<number, SavedRecap>();

  [...(remote?.saved ?? []), ...(local?.saved ?? [])].forEach((recap) =>
    saved.set(recap.created, recap)
  );
  deleted.forEach((created) => saved.delete(created));

  return {
    title,
    chapters: { ...remote?.chapters, ...local?.chapters },
    saved: [...saved.values()].sort((a, b) => a.created - b.created),
    deletedSaved: deleted.sort((a, b) => a - b)
  };
}

/** Whether two copies hold the same summaries and recaps. */
export function sameRecaps(a?: BookRecaps, b?: BookRecaps) {
  const signature = (r?: BookRecaps) =>
    JSON.stringify([
      Object.entries(r?.chapters ?? {})
        .map(([key, chapter]) => `${key}:${chapter.model}`)
        .sort(),
      (r?.saved ?? []).map((recap) => recap.created).sort(),
      [...(r?.deletedSaved ?? [])].sort()
    ]);

  return signature(a) === signature(b);
}

async function getRecaps(title: string): Promise<BookRecaps> {
  return (await (await readerDb()).get('recaps', title)) || { title, chapters: {} };
}

async function putRecaps(recaps: BookRecaps) {
  await (await readerDb()).put('recaps', recaps);
  recapsChanged$.next(recaps);
}

/** Saved recaps, by position in the book. */
export async function getSavedRecaps(title: string) {
  return [...((await getRecaps(title)).saved ?? [])].sort((a, b) => a.position - b.position);
}

export async function deleteSavedRecap(title: string, created: number) {
  const recaps = await getRecaps(title);

  recaps.saved = (recaps.saved ?? []).filter((recap) => recap.created !== created);
  recaps.deletedSaved = [...(recaps.deletedSaved ?? []), created];
  await putRecaps(recaps);
}

export interface RecapPart {
  key: string;
  label: string;
  start: number;
  end: number;
}

export interface RecapPlan {
  /** Parts fully read, summarised individually */
  finished: RecapPart[];
  /** Parts without a cached summary */
  missing: RecapPart[];
  /** Characters of text that would be sent for the missing parts */
  missingCharacters: number;
  model: string;
}

export function recapModel() {
  return openRouterRecapModel$.getValue().trim() || openRouterModel$.getValue();
}

/**
 * Text from `start` to `end`. Paragraphs containing either are cut there, so
 * nothing later is sent and an update that stopped mid-paragraph resumes there.
 */
export function textBetween(index: SearchIndex, start: number, end: number) {
  const { paragraphs } = index;

  return paragraphs
    .filter((p, i) => p.startCount < end && (paragraphs[i + 1]?.startCount ?? Infinity) > start)
    .map((p) =>
      displayText(
        p.text.slice(
          // Keeps leading punctuation (「…) of paragraphs that start inside the range.
          start > p.startCount ? offsetForCount(p.text, start - p.startCount) : 0,
          offsetForCount(p.text, end - p.startCount)
        )
      )
    )
    .join('\n');
}

function bookParts(sections: Section[], bookCharacters: number): RecapPart[] {
  const chapters = sections
    .filter((s) => !s.parentChapter && s.startCharacter !== undefined && (s.characters ?? 1) > 0)
    .sort((a, b) => (a.startCharacter ?? 0) - (b.startCharacter ?? 0));

  if (chapters.length >= 2) {
    return chapters.map((chapter, i) => ({
      key: chapter.reference,
      label: chapter.label || `Part ${i + 1}`,
      start: chapter.startCharacter ?? 0,
      end: chapters[i + 1]?.startCharacter ?? bookCharacters
    }));
  }

  // No usable table of contents: fixed-size parts.
  const parts: RecapPart[] = [];

  for (let start = 0; start < bookCharacters; start += chunkCharacters) {
    parts.push({
      key: `chunk-${start}`,
      label: `Part ${parts.length + 1}`,
      start,
      end: Math.min(start + chunkCharacters, bookCharacters)
    });
  }

  return parts;
}

/**
 * What a recap would send: the finished parts and which of them still need a
 * summary for the current model. Shown to the user before anything is sent.
 */
export async function planRecap(
  title: string,
  index: SearchIndex,
  sections: Section[],
  position: number,
  bookCharacters: number
): Promise<RecapPlan> {
  const model = recapModel();
  const cached = (await getRecaps(title)).chapters;
  const finished = bookParts(sections, bookCharacters).filter((part) => part.end <= position);
  const missing = finished.filter((part) => cached[part.key]?.model !== model);

  return {
    finished,
    missing,
    missingCharacters: missing.reduce(
      (sum, part) =>
        sum + Math.min(textBetween(index, part.start, part.end).length, maxChapterText),
      0
    ),
    model
  };
}

function clipped(text: string) {
  if (text.length <= maxChapterText) {
    return text;
  }

  const half = maxChapterText / 2;

  return `${text.slice(0, half)}\n\n[...middle of the chapter left out...]\n\n${text.slice(-half)}`;
}

export async function writeRecap(
  title: string,
  index: SearchIndex,
  plan: RecapPlan,
  position: number,
  onProgress: (message: string) => void,
  onText: (text: string) => void,
  signal: AbortSignal
) {
  const recaps = await getRecaps(title);

  for (let i = 0; i < plan.missing.length; i += 1) {
    const part = plan.missing[i];

    onProgress(`Summarising ${part.label} (${i + 1} of ${plan.missing.length})`);

    const text = clipped(textBetween(index, part.start, part.end));
    const answer = await askAi(
      [{ role: 'user', content: `Book: ${title}\nChapter: ${part.label}\n\n${text}` }],
      () => {},
      signal,
      { model: plan.model, system: aiPrompts().chapter }
    );

    recaps.chapters[part.key] = {
      summary: answer[answer.length - 1].content,
      characters: part.end - part.start,
      model: plan.model
    };
    await putRecaps(recaps);
  }

  onProgress('Writing the recap');

  const summaries = plan.finished
    .map((part) => `### ${part.label}\n${recaps.chapters[part.key]?.summary ?? ''}`)
    .join('\n\n');
  const lastFinishedEnd = plan.finished[plan.finished.length - 1]?.end ?? 0;
  const recent = textBetween(index, lastFinishedEnd, position).slice(-recentText);

  const answer = await askAi(
    [
      {
        role: 'user',
        content: `Book: ${title}\n\n<chapter_summaries>\n${
          summaries || '(none, the reader is still in the first part)'
        }\n</chapter_summaries>\n\n<text_before_stopping_point>\n${recent}\n</text_before_stopping_point>`
      }
    ],
    onText,
    signal,
    { model: plan.model, system: aiPrompts().recap }
  );
  const saved: SavedRecap = {
    position,
    text: answer[answer.length - 1].content,
    created: Date.now(),
    model: plan.model
  };

  // Re-read: the summaries above were saved meanwhile.
  const latest = await getRecaps(title);

  latest.saved = [...(latest.saved ?? []), saved];
  await putRecaps(latest);

  return saved;
}
