/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Series set by readers (the series generator in the library), shared by
 * everyone through /calibre/sync/series.json. They override the catalog's
 * series by title; an empty series takes a book out of its catalog series.
 * Not part of upstream.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';

export interface SeriesOverride {
  series: string;
  modified: number;
}

export type SeriesOverrides = Record<string, SeriesOverride>;

const overridesUrl = '/calibre/sync/series.json';
const maxSeriesLength = 200;

let cache: Promise<SeriesOverrides> | undefined;

/** Keeps only well-formed entries: the file is writable by every reader. */
export function parseSeriesOverrides(data: unknown): SeriesOverrides {
  const result: SeriesOverrides = {};

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return result;
  }

  Object.entries(data).forEach(([title, entry]) => {
    if (
      entry &&
      typeof entry.series === 'string' &&
      entry.series.length <= maxSeriesLength &&
      typeof entry.modified === 'number'
    ) {
      result[title] = { series: entry.series.trim(), modified: entry.modified };
    }
  });

  return result;
}

async function fetchSeriesOverrides() {
  const response = await fetch(overridesUrl, { cache: 'no-store' });

  if (response.status === 404) {
    return {};
  }
  if (!response.ok) {
    throw new Error(`Series list unavailable (HTTP ${response.status})`);
  }

  return parseSeriesOverrides(await response.json());
}

/** Fetched once per session like the catalog; `refresh` refetches. Failures are not cached. */
export function loadSeriesOverrides(refresh = false) {
  if (refresh) {
    cache = undefined;
  }

  cache ??= fetchSeriesOverrides().catch((error) => {
    cache = undefined;
    throw error;
  });

  return cache;
}

/** Sets the series of each title (`''` for none), on top of the latest server copy. */
export async function saveSeriesOverrides(changes: Record<string, string>) {
  const modified = Date.now();
  // shortcut: read-merge-write without locking, so two readers saving in the same second can lose one change; add ETag checks if that happens.
  const overrides = { ...(await fetchSeriesOverrides()) };

  Object.entries(changes).forEach(([title, series]) => {
    overrides[title] = { series: series.trim().slice(0, maxSeriesLength), modified };
  });

  const response = await fetch(overridesUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides)
  });

  if (!response.ok) {
    throw new Error(`Saving the series failed (HTTP ${response.status})`);
  }

  cache = Promise.resolve(overrides);

  return overrides;
}

export function applySeriesOverride(card: BookCardProps, overrides: SeriesOverrides) {
  const override = overrides[card.title];

  if (!override) {
    return card;
  }

  return override.series === card.series
    ? card
    : {
        ...card,
        series: override.series || undefined,
        seriesIndex: null,
        seriesInferred: false
      };
}

function normalize(text: string) {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
}

const editionLabel =
  /[\s]*[【[(（〔][^】\])）〕]*(?:版|文庫|ノベル|BOOKS|Books|特典|限定|特装|コミック)[^】\])）〕]*[】\])）〕]$/;
const volumeMark =
  /[\s]*[(（[【〈《]?\s*(?:vol(?:ume)?\.?\s*|[#＃]|第\s*)?(?:\d+(?:\.\d+)?|[〇一二三四五六七八九十百]+(?=\s*[巻部集冊]))\s*[巻部章話集冊]?\s*[)）\]】〉》]?/gi;

/**
 * Likely series name of a title: the text before its last volume number
 * (like `split_volume` in build-catalog.py), without author prefixes and
 * edition labels. Titles without a number are returned whole.
 */
export function guessSeriesName(title: string) {
  const text = title
    .normalize('NFKC')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(editionLabel, '')
    .trim();
  const marks = [...text.matchAll(volumeMark)];
  const last = marks[marks.length - 1];
  const base = last?.index ? text.slice(0, last.index) : text;

  return base.replace(/[\s\-‐－:：・,、～~―]+$/, '').trim() || text;
}

/** Books whose title contains the series name (width, case and spaces ignored). */
export function findSeriesBooks<T extends { title: string }>(books: T[], name: string) {
  const term = normalize(name);

  return term ? books.filter((book) => normalize(book.title).includes(term)) : [];
}

/** The longest existing series name contained in the title, for a newly imported book. */
export function seriesForTitle(books: BookCardProps[], title: string) {
  const text = normalize(title);
  let best = '';

  new Set(books.map((book) => book.series).filter(Boolean)).forEach((series) => {
    if (series!.length > best.length && series!.length >= 2 && text.includes(normalize(series!))) {
      best = series!;
    }
  });

  return best;
}
