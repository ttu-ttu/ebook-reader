/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';
import { difficultyBand, difficultyNames } from '$lib/data/difficulty';

export interface LibraryFilter {
  key: string;
  label: string;
  test: (card: BookCardProps, now: number) => boolean;
}

export interface LibraryFilterSection {
  key: string;
  label: string;
  filters: LibraryFilter[];
}

const dayMs = 24 * 60 * 60 * 1000;
const completedThreshold = 0.995;

export function isFinished(card: BookCardProps) {
  return card.progress >= completedThreshold;
}

/** Started but not finished. */
export function isReading(card: BookCardProps) {
  return card.progress > 0 && card.progress < completedThreshold;
}

export const allBooksFilter: LibraryFilter = {
  key: 'all',
  label: 'All books',
  test: () => true
};

export const libraryFilterSections: LibraryFilterSection[] = [
  {
    key: 'type',
    label: 'Type',
    filters: [
      { key: 'books', label: 'Books', test: (card) => !card.manga && !card.vn },
      { key: 'manga', label: 'Manga', test: (card) => !!card.manga },
      { key: 'vn', label: 'Visual novels', test: (card) => !!card.vn }
    ]
  },
  {
    key: 'status',
    label: 'Reading status',
    filters: [
      { key: 'unread', label: 'Unread', test: (card) => !card.progress },
      {
        key: 'reading',
        label: 'Reading',
        test: isReading
      },
      {
        key: 'completed',
        label: 'Completed',
        test: isFinished
      }
    ]
  },
  {
    key: 'activity',
    label: 'Last read',
    filters: [
      {
        key: 'week',
        label: 'Past 7 days',
        test: (card, now) => !!card.lastBookOpen && now - card.lastBookOpen <= 7 * dayMs
      },
      {
        key: 'month',
        label: 'Past 30 days',
        test: (card, now) => !!card.lastBookOpen && now - card.lastBookOpen <= 30 * dayMs
      },
      {
        key: 'older',
        label: 'Older',
        test: (card, now) => !!card.lastBookOpen && now - card.lastBookOpen > 30 * dayMs
      },
      { key: 'never', label: 'Never opened', test: (card) => !card.lastBookOpen }
    ]
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    filters: [
      ...difficultyNames.slice(0, 5).map((name, band) => ({
        key: `difficulty-${band}`,
        label: name,
        test: (card: BookCardProps) =>
          card.difficulty !== undefined && Math.min(difficultyBand(card.difficulty), 4) === band
      })),
      {
        key: 'difficulty-none',
        label: 'Not estimated',
        test: (card) => card.difficulty === undefined
      }
    ]
  },
  {
    key: 'length',
    label: 'Length',
    filters: [
      {
        key: 'short',
        label: 'Under 100k characters',
        test: (card) => card.characters > 0 && card.characters < 100_000
      },
      {
        key: 'medium',
        label: '100k – 150k characters',
        test: (card) => card.characters >= 100_000 && card.characters < 150_000
      },
      {
        key: 'medium-long',
        label: '150k – 200k characters',
        test: (card) => card.characters >= 150_000 && card.characters < 200_000
      },
      {
        key: 'longer',
        label: '200k – 300k characters',
        test: (card) => card.characters >= 200_000 && card.characters <= 300_000
      },
      {
        key: 'long',
        label: 'Over 300k characters',
        test: (card) => card.characters > 300_000
      }
    ]
  }
];

const filtersByKey = new Map(
  [allBooksFilter, ...libraryFilterSections.flatMap((section) => section.filters)].map((filter) => [
    filter.key,
    filter
  ])
);

const seriesPrefix = 'series:';

/** Filter key showing one series (Store → Series). */
export function seriesFilterKey(series: string) {
  return `${seriesPrefix}${series}`;
}

export function getLibraryFilter(key: string) {
  if (key.startsWith(seriesPrefix)) {
    const series = key.slice(seriesPrefix.length);

    return { key, label: series, test: (card: BookCardProps) => card.series === series };
  }

  return filtersByKey.get(key) ?? allBooksFilter;
}

export function filterBookCards(
  bookCards: BookCardProps[],
  filterKey: string,
  searchTerm: string,
  now = Date.now()
) {
  const filter = getLibraryFilter(filterKey);
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

  return bookCards.filter(
    (card) =>
      filter.test(card, now) &&
      (!normalizedSearch ||
        card.title.toLocaleLowerCase().includes(normalizedSearch) ||
        !!card.authors?.toLocaleLowerCase().includes(normalizedSearch) ||
        !!card.series?.toLocaleLowerCase().includes(normalizedSearch) ||
        !!card.tags?.some((tag) => tag.toLocaleLowerCase().includes(normalizedSearch)))
  );
}

export function countBookCards(
  bookCards: BookCardProps[],
  sections: LibraryFilterSection[] = libraryFilterSections,
  now = Date.now()
) {
  const counts = new Map<string, number>();

  [allBooksFilter, ...sections.flatMap((section) => section.filters)].forEach((filter) => {
    counts.set(filter.key, bookCards.filter((card) => filter.test(card, now)).length);
  });

  return counts;
}
