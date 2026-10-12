/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Access to the self-hosted Calibre library, served read-only by nginx
 * (see scripts/calibre/). Not part of upstream.
 */

export interface CalibreBook {
  id: number;
  title: string;
  authors: string;
  series: string;
  seriesIndex: number | null;
  /** Series guessed from volume numbers in titles rather than set in Calibre */
  seriesInferred?: boolean;
  tags?: string[];
  /** 0-5 stars */
  rating?: number | null;
  publisher?: string;
  /** Epoch milliseconds */
  published?: number | null;
  /** Epoch milliseconds */
  added: number;
  format: string;
  /** A CBZ/ZIP holding an ONScripter game rather than manga */
  vn?: boolean;
  size: number;
  file: string;
  cover: string;
}

/** Difficulty estimate (chimi-difficulty, run on demand on the server), 0-5. */
export interface CalibreDifficulty {
  /** Output of Jiten's local model */
  difficulty: number;
  /** With the adjustment jiten.moe applies (fitted to its newer hosted model) */
  adjusted: number;
  /** 10th and 90th percentile of the estimate (older estimates have none) */
  low?: number;
  high?: number;
  /** Top-N words a reader needs to know for 95% of the book's words */
  words95?: number | null;
  characters: number;
  uniqueKanji: number;
  computedAt: number;
}

const catalogUrl = '/calibre/catalog.json';
const difficultyUrl = '/calibre/difficulty.json';
export const difficultyApiUrl = '/calibre/difficulty/api/';
const libraryUrl = '/calibre/library/';

let catalogCache: Promise<CalibreBook[]> | undefined;

/**
 * The catalog, fetched once per session (it is several MB for a large library);
 * `refresh` refetches it, e.g. when the library list is reloaded. Failures are not cached.
 */
export function loadCalibreCatalog(refresh = false) {
  if (refresh) {
    catalogCache = undefined;
  }

  catalogCache ??= fetch(catalogUrl, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Calibre catalog unavailable (HTTP ${response.status})`);
      }

      return response.json();
    })
    .then((catalog: { books: CalibreBook[] }) => catalog.books)
    .catch((error) => {
      catalogCache = undefined;
      throw error;
    });

  return catalogCache;
}

export async function loadCalibreDifficulty(): Promise<Record<string, CalibreDifficulty>> {
  const response = await fetch(difficultyUrl, { cache: 'no-cache' });

  if (!response.ok) {
    return {};
  }

  return (await response.json()).books || {};
}

/** How often each kanji occurs in a book with an estimate; undefined if it has none. */
export async function loadBookKanji(id: number): Promise<Record<string, number> | undefined> {
  const response = await fetch(`${difficultyApiUrl}kanji/${id}`, { cache: 'no-cache' });

  return response.ok ? response.json() : undefined;
}

function toLibraryUrl(path: string) {
  return `${libraryUrl}${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function calibreBookUrl(book: CalibreBook) {
  return toLibraryUrl(book.file);
}

export function calibreCoverUrl(book: CalibreBook) {
  return book.cover ? toLibraryUrl(book.cover) : '';
}

export function calibreBookFileName(book: CalibreBook) {
  return `${book.title.replace(/[\\/]/g, '_')}.${book.format.toLowerCase()}`;
}

export async function downloadCalibreBook(book: CalibreBook) {
  const response = await fetch(calibreBookUrl(book));

  if (!response.ok) {
    throw new Error(`${book.title}: download failed (HTTP ${response.status})`);
  }

  return new File([await response.blob()], calibreBookFileName(book));
}
