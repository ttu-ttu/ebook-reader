/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export interface BookCardProps {
  id: number;
  imagePath: string | Blob;
  title: string;
  characters: number;
  lastBookModified: number;
  lastBookOpen: number;
  progress: number;
  lastBookmarkModified: number;
  isPlaceholder: boolean;
  authors?: string;
  series?: string;
  seriesIndex?: number | null;
  seriesInferred?: boolean;
  tags?: string[];
  rating?: number | null;
  /** Jiten-style difficulty, 0-5 */
  difficulty?: number;
  /** CBZ/ZIP read in the manga reader */
  manga?: boolean;
  /** Calibre book id, for books from the Calibre source */
  calibreId?: number;
}
