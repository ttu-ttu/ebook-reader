/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Book details fetched from AniList (books, manga), VNDB (visual novels) or
 * Jiten (all three, through nginx's /jiten/search: its API only allows
 * jiten.moe) on a book's page, shared by everyone through
 * /calibre/sync/metadata.json and keyed by title like series.json. A saved
 * cover replaces the card's, a VNDB title the card's title.
 * Not part of upstream.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';

export type MetadataKind = 'book' | 'manga' | 'vn';

export type MetadataSource = 'anilist' | 'vndb' | 'jiten';

export interface BookMetadata {
  source: MetadataSource;
  /** The entry's page on the source */
  url: string;
  title: string;
  description: string;
  /** '' when the book keeps its own cover */
  cover: string;
  genres: string[];
  /** YYYY, YYYY-MM or YYYY-MM-DD */
  released: string;
  /** 0-100 */
  score: number | null;
  modified: number;
}

export type MetadataCandidate = Omit<BookMetadata, 'modified'>;

export type BookMetadataMap = Record<string, BookMetadata>;

const metadataUrl = '/calibre/sync/metadata.json';
const sources: MetadataSource[] = ['anilist', 'vndb', 'jiten'];
const pagePrefixes = ['https://anilist.co/', 'https://vndb.org/', 'https://jiten.moe/'];
const coverPrefixes = ['https://s4.anilist.co/', 'https://t.vndb.org/', 'https://cdn.jiten.moe/'];
const maxDescription = 5000;

let cache: Promise<BookMetadataMap> | undefined;

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : '';

/** Keeps only well-formed entries with links to the two sources: the file is writable by readers. */
export function parseBookMetadata(data: unknown): BookMetadataMap {
  const result: BookMetadataMap = {};

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return result;
  }

  Object.entries(data).forEach(([title, entry]) => {
    if (
      !entry ||
      !sources.includes(entry.source) ||
      typeof entry.url !== 'string' ||
      !pagePrefixes.some((prefix) => entry.url.startsWith(prefix)) ||
      typeof entry.modified !== 'number'
    ) {
      return;
    }

    const cover = text(entry.cover, 500);

    result[title] = {
      source: entry.source,
      url: entry.url.slice(0, 500),
      title: text(entry.title, 300),
      description: text(entry.description, maxDescription),
      cover: coverPrefixes.some((prefix) => cover.startsWith(prefix)) ? cover : '',
      genres: Array.isArray(entry.genres)
        ? entry.genres.filter((genre: unknown) => typeof genre === 'string').slice(0, 20)
        : [],
      released: text(entry.released, 10),
      score: typeof entry.score === 'number' ? entry.score : null,
      modified: entry.modified
    };
  });

  return result;
}

async function fetchBookMetadata() {
  const response = await fetch(metadataUrl, { cache: 'no-store' });

  if (response.status === 404) {
    return {};
  }
  if (!response.ok) {
    throw new Error(`Book details unavailable (HTTP ${response.status})`);
  }

  return parseBookMetadata(await response.json());
}

/** Fetched once per session; `refresh` refetches. Failures are not cached. */
export function loadBookMetadata(refresh = false) {
  if (refresh) {
    cache = undefined;
  }

  cache ??= fetchBookMetadata().catch((error) => {
    cache = undefined;
    throw error;
  });

  return cache;
}

/** Saves (or with `undefined` removes) a title's details on top of the latest server copy. */
export async function saveBookMetadata(title: string, entry: MetadataCandidate | undefined) {
  // shortcut: read-merge-write without locking like series.json; add ETag checks if two editors collide.
  const map = { ...(await fetchBookMetadata()) };

  if (entry) {
    map[title] = { ...entry, modified: Date.now() };
  } else {
    delete map[title];
  }

  const response = await fetch(metadataUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(map)
  });

  if (!response.ok) {
    throw new Error(`Saving the details failed (HTTP ${response.status})`);
  }

  cache = Promise.resolve(map);

  return map;
}

export function applyMetadata(card: BookCardProps, map: BookMetadataMap) {
  const entry = map[card.title];
  // Only VNDB's: AniList and Jiten name a whole series, not this volume.
  const displayTitle = entry?.source === 'vndb' ? entry.title : '';

  if (!entry?.cover && !displayTitle) {
    return card;
  }

  return {
    ...card,
    ...(entry.cover ? { imagePath: entry.cover } : {}),
    ...(displayTitle ? { displayTitle } : {})
  };
}

/** Plain text of AniList's HTML/markdown or VNDB's BBCode, spoilers removed. */
export function cleanDescription(value: string) {
  const withoutMarkup = value
    .replace(/~!.*?!~/gs, '')
    .replace(/\[spoiler\].*?\[\/spoiler\]/gis, '')
    .replace(/\[url=[^\]]*\](.*?)\[\/url\]/gis, '$1')
    .replace(/\[\/?[a-z]+\]/gi, '')
    .replace(/<br\s*\/?>/gi, '\n');
  // Inert document: nothing in it runs or loads.
  const body = new DOMParser().parseFromString(withoutMarkup, 'text/html').body;

  return (body.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxDescription);
}

async function postJson(url: string, body: object) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Search failed (HTTP ${response.status})`);
  }

  return response.json();
}

const aniListQuery = `query ($search: String, $formats: [MediaFormat]) {
  Page(perPage: 8) {
    media(search: $search, type: MANGA, format_in: $formats) {
      siteUrl
      title { native romaji }
      description(asHtml: false)
      coverImage { extraLarge }
      genres
      averageScore
      startDate { year month day }
    }
  }
}`;

async function searchAniList(query: string, kind: 'book' | 'manga'): Promise<MetadataCandidate[]> {
  const { data } = await postJson('https://graphql.anilist.co', {
    query: aniListQuery,
    variables: { search: query, formats: kind === 'book' ? ['NOVEL'] : ['MANGA', 'ONE_SHOT'] }
  });

  return (data?.Page?.media ?? []).map((media: any) => ({
    source: 'anilist',
    url: media.siteUrl,
    title: media.title?.native || media.title?.romaji || '',
    description: cleanDescription(media.description || ''),
    cover: media.coverImage?.extraLarge || '',
    genres: media.genres ?? [],
    released: [media.startDate?.year, media.startDate?.month, media.startDate?.day]
      .filter(Boolean)
      .map((part: number) => String(part).padStart(2, '0'))
      .join('-'),
    score: media.averageScore ?? null
  }));
}

async function searchVndb(query: string): Promise<MetadataCandidate[]> {
  const { results } = await postJson('https://api.vndb.org/kana/vn', {
    filters: ['search', '=', query],
    fields:
      'title,alttitle,description,image.url,released,rating,tags.name,tags.rating,tags.spoiler',
    sort: 'searchrank',
    results: 8
  });

  return (results ?? []).map((vn: any) => ({
    source: 'vndb',
    url: `https://vndb.org/${vn.id}`,
    title: vn.alttitle || vn.title || '',
    description: cleanDescription(vn.description || ''),
    cover: vn.image?.url || '',
    genres: (vn.tags ?? [])
      .filter((tag: any) => tag.spoiler === 0 && tag.rating >= 2)
      .sort((a: any, b: any) => b.rating - a.rating)
      .slice(0, 8)
      .map((tag: any) => tag.name),
    released: vn.released && vn.released !== 'TBA' ? vn.released : '',
    score: vn.rating === null || vn.rating === undefined ? null : Math.round(vn.rating)
  }));
}

// Jiten's MediaType and Genre enums (api.jiten.moe/swagger).
const jitenTypes: Record<MetadataKind, number[]> = { book: [4, 5, 8], manga: [9], vn: [7] };
const jitenGenres = [
  '',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  'Adult'
];

export function parseJitenDecks(data: any, kind: MetadataKind): MetadataCandidate[] {
  return (data?.data ?? [])
    .filter((deck: any) => jitenTypes[kind].includes(deck.mediaType) && !deck.parentDeckId)
    .slice(0, 8)
    .map((deck: any) => ({
      source: 'jiten',
      url: `https://jiten.moe/decks/media/${deck.deckId}/detail`,
      title: deck.originalTitle || deck.romajiTitle || deck.englishTitle || '',
      description: cleanDescription(deck.description || ''),
      cover: deck.coverName || '',
      genres: [
        ...(deck.genres ?? []).map((genre: number) => jitenGenres[genre]).filter(Boolean),
        ...(deck.tags ?? [])
          .filter((tag: any) => tag.percentage >= 60)
          .slice(0, 5)
          .map((tag: any) => tag.name)
      ],
      released: (deck.releaseDate || '').slice(0, 10),
      score: typeof deck.externalRating === 'number' ? deck.externalRating : null
    }));
}

async function searchJiten(query: string, kind: MetadataKind) {
  const response = await fetch(`/jiten/search?titleFilter=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error(`Search failed (HTTP ${response.status})`);
  }

  return parseJitenDecks(await response.json(), kind);
}

export const sourceNames: Record<MetadataSource, string> = {
  anilist: 'AniList',
  vndb: 'VNDB',
  jiten: 'Jiten'
};

export function defaultSource(kind: MetadataKind): MetadataSource {
  return kind === 'vn' ? 'vndb' : 'anilist';
}

export function searchMetadata(kind: MetadataKind, query: string, source = defaultSource(kind)) {
  if (source === 'jiten') {
    return searchJiten(query, kind);
  }

  return kind === 'vn' ? searchVndb(query) : searchAniList(query, kind);
}
