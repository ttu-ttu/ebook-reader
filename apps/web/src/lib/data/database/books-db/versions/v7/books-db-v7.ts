/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type BooksDbV6 from '$lib/data/database/books-db/versions/v6/books-db-v6';

export type BookmarkColor =
  | 'blue'
  | 'red'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'teal'
  | 'gray';

export const BOOKMARK_COLORS: Record<BookmarkColor, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  pink: '#ec4899',
  orange: '#f97316',
  teal: '#14b8a6',
  gray: '#6b7280'
};

export interface BooksDbV7UserBookmarkData {
  id?: number;
  dataId: number;
  exploredCharCount: number;
  progress: number;
  label: string;
  color: BookmarkColor;
  note: string;
  createdAt: number;
  lastModified: number;
}

export default interface BooksDbV7 extends BooksDbV6 {
  userBookmark: {
    key: number;
    value: BooksDbV7UserBookmarkData;
    indexes: {
      dataId: number;
    };
  };
}
