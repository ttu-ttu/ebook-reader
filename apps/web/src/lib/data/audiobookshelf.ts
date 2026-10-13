/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Audiobookshelf (https://www.audiobookshelf.org) through the server's
 * `/audiobookshelf/` proxy (AUDIOBOOKSHELF_URL): finds a book's audiobook,
 * streams it and keeps its progress there. Not part of upstream.
 */

import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';
import { writableObjectLocalStorageSubject } from '$lib/data/internal/writable-object-local-storage-subject';
import { redactSecret } from '$lib/data/ai-settings';
import { readerDb } from '$lib/data/reader-db';
import { titleVolume } from '$lib/components/book-card/library-sort';
import type { MatchedCue } from '$lib/functions/audiobook/subtitles';

export const absBaseUrl = '/audiobookshelf';

/** The Audiobookshelf user's token or API key; belongs to the account like the AI keys. */
export const audiobookshelfToken$ = writableStringLocalStorageSubject()('audiobookshelfToken', '');

export interface AbsTrack {
  ino: string;
  /** Seconds from the start of the candidate */
  startOffset: number;
  duration: number;
}

export interface AbsCandidate {
  itemId: string;
  label: string;
  tracks: AbsTrack[];
  /** The whole library item, so progress is kept in Audiobookshelf */
  wholeItem: boolean;
  /** Subtitle files (ino) stored with the audio in Audiobookshelf */
  subtitles: string[];
}

/** Book title → the candidate picked for it (and the position, for single files) */
export const absMatches$ = writableObjectLocalStorageSubject<
  Record<string, { candidate: AbsCandidate; position?: number }>
>()('audiobookshelfMatches', {});

async function absFetch(path: string, init: RequestInit = {}) {
  const token = audiobookshelfToken$.getValue();

  if (!token) {
    throw new Error('Not connected to Audiobookshelf (Settings → Audiobookshelf)');
  }

  const response = await fetch(`${absBaseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const text = redactSecret(await response.text().catch(() => ''), token);

    throw new Error(`Audiobookshelf: ${response.status} ${text.slice(0, 200)}`);
  }

  return response;
}

/** Signs in and returns the user's token; the password isn't kept. */
export async function absLogin(username: string, password: string) {
  const response = await fetch(`${absBaseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (response.status === 404) {
    throw new Error('This server has no Audiobookshelf address (AUDIOBOOKSHELF_URL)');
  }
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'Wrong username or password' : `Sign-in failed (${response.status})`
    );
  }

  // shortcut: the long-lived legacy token ABS 2.x still returns; switch to API keys when ABS drops it.
  const token: string | undefined = (await response.json()).user?.token;

  if (!token) {
    throw new Error('Audiobookshelf returned no token; paste an API key instead');
  }

  return token;
}

/** Letters and digits only, width and case folded, for comparing titles with file names. */
export function absMatchKey(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** A title or file name without its extension and bracketed tags ([1巻], (MFブックス), 【特典】, [ASIN]). */
export function absCleanTitle(text: string) {
  return text
    .normalize('NFKC')
    .replace(/\.(m4b|m4a|mp3|aac|flac|ogg|opus|wav|srt|vtt)$/i, '')
    .replace(/\[[^\]]*\]|【[^】]*】|\([^)]*\)|『|』/g, ' ')
    .trim();
}

/** The cleaned title without a trailing volume number: the series name, for searching. */
function absBaseTitle(text: string) {
  return absCleanTitle(text)
    .replace(/\s*(第?\d+(?:\.\d+)?[巻部集]?|[上中下])\s*$/, '')
    .trim();
}

/** Whether an Audiobookshelf title or file name is this book: same name and volume. */
export function absSameBook(title: string, label: string) {
  const book = absMatchKey(absBaseTitle(title));
  const other = absMatchKey(absBaseTitle(label));
  const bookVolume = titleVolume(absCleanTitle(title));
  const otherVolume = titleVolume(absCleanTitle(label));

  if (!book || !other) {
    return false;
  }
  if (book === other) {
    // An unnumbered title may be the first volume.
    return (
      bookVolume === otherVolume ||
      (bookVolume === undefined && otherVolume === 1) ||
      (otherVolume === undefined && bookVolume === 1)
    );
  }

  // One name inside the other (subtitles, edition notes): the same volume only.
  return (other.includes(book) || book.includes(other)) && bookVolume === otherVolume;
}

interface AbsAudioFile {
  ino: string;
  index: number;
  duration: number;
  metadata: { filename: string };
}

interface AbsLibraryFile {
  ino: string;
  metadata: { filename: string; ext: string };
}

export interface AbsItem {
  id: string;
  media: { metadata: { title: string }; audioFiles: AbsAudioFile[] };
  libraryFiles?: AbsLibraryFile[];
}

/**
 * What to play from one library item that may be this book: the files named
 * like it when the item is a folder of several books (a scan that grouped
 * them), else the whole item if its title is the book's.
 */
export function candidatesFromItem(title: string, item: AbsItem): AbsCandidate[] {
  const files = [...item.media.audioFiles].sort((a, b) => a.index - b.index);
  const subtitles = (item.libraryFiles ?? []).filter((file) =>
    /^\.(srt|vtt)$/i.test(file.metadata.ext)
  );
  const subtitlesFor = (name: string) =>
    subtitles
      .filter(
        (file) =>
          absMatchKey(absCleanTitle(file.metadata.filename)) === absMatchKey(absCleanTitle(name))
      )
      .map((file) => file.ino);
  const named =
    files.length > 1 ? files.filter((file) => absSameBook(title, file.metadata.filename)) : [];

  if (named.length) {
    return named.map((file) => ({
      itemId: item.id,
      label: file.metadata.filename,
      tracks: [{ ino: file.ino, startOffset: 0, duration: file.duration }],
      wholeItem: false,
      subtitles: subtitlesFor(file.metadata.filename)
    }));
  }
  if (!absSameBook(title, item.media.metadata.title)) {
    return [];
  }

  let offset = 0;

  return [
    {
      itemId: item.id,
      label: item.media.metadata.title,
      tracks: files.map((file) => {
        const track = { ino: file.ino, startOffset: offset, duration: file.duration };

        offset += file.duration;
        return track;
      }),
      wholeItem: true,
      // One audio file: its own subtitles; several: the item's only subtitle file.
      subtitles:
        files.length === 1
          ? subtitlesFor(files[0].metadata.filename)
          : subtitles.length === 1
            ? [subtitles[0].ino]
            : []
    }
  ];
}

/** Audiobooks in every book library that may be this book, best first. */
export async function findAbsCandidates(title: string) {
  const { libraries } = await (await absFetch('/api/libraries')).json();
  // Search by the first word of the series name: Audiobookshelf matches substrings,
  // and the book's own title often has tags (MFブックス) or other dashes (〜/～).
  const word = absBaseTitle(title)
    .split(/[^\p{L}\p{N}]+/u)
    .find((part) => part.length > 1);
  const queries = [...new Set([word, title].filter((query): query is string => !!query))];
  const found = new Map<string, AbsCandidate>();

  for (const library of libraries.filter((l: { mediaType: string }) => l.mediaType === 'book')) {
    for (const query of queries) {
      const { book } = await (
        await absFetch(
          `/api/libraries/${library.id}/search?q=${encodeURIComponent(query)}&limit=50`
        )
      ).json();

      for (const { libraryItem } of book as { libraryItem: AbsItem }[]) {
        candidatesFromItem(title, libraryItem).forEach((candidate) =>
          found.set(absCandidateKey(candidate), candidate)
        );
      }
      if (found.size) {
        break;
      }
    }
  }

  const key = absMatchKey(absBaseTitle(title));

  // Same series name first, then the shortest (no side stories).
  return [...found.values()].sort(
    (a, b) =>
      Number(absMatchKey(absBaseTitle(b.label)) === key) -
        Number(absMatchKey(absBaseTitle(a.label)) === key) || a.label.length - b.label.length
  );
}

/** A track's address for <audio>, which can't send headers: the token goes in the URL. */
export function absTrackUrl(itemId: string, track: AbsTrack) {
  return `${absBaseUrl}/api/items/${itemId}/file/${track.ino}?token=${encodeURIComponent(audiobookshelfToken$.getValue())}`;
}

export async function getAbsProgress(itemId: string): Promise<number> {
  try {
    return (await (await absFetch(`/api/me/progress/${itemId}`)).json()).currentTime ?? 0;
  } catch (_) {
    // No progress yet (404)
    return 0;
  }
}

export async function saveAbsProgress(itemId: string, currentTime: number, duration: number) {
  await absFetch(`/api/me/progress/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentTime,
      duration,
      progress: duration ? Math.min(1, currentTime / duration) : 0,
      isFinished: duration > 0 && currentTime >= duration - 5
    })
  });
}

/** A library file's text (subtitles), with the token in the header. */
export async function absFileText(itemId: string, ino: string) {
  return (await absFetch(`/api/items/${itemId}/file/${ino}`)).text();
}

/** Subtitle lines matched to the book, for the candidate they were made for. */
export interface AbsSubtitles {
  title: string;
  /** itemId/label of the candidate */
  candidate: string;
  subtitleName: string;
  cues: MatchedCue[];
}

export const absCandidateKey = (candidate: AbsCandidate) =>
  `${candidate.itemId}/${candidate.label}`;

export async function getAbsSubtitles(title: string) {
  return (await readerDb()).get('absSubtitles', title);
}

export async function putAbsSubtitles(subtitles: AbsSubtitles) {
  await (await readerDb()).put('absSubtitles', subtitles);
}

export async function deleteAbsSubtitles(title: string) {
  await (await readerDb()).delete('absSubtitles', title);
}
