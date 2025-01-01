/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
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
}
