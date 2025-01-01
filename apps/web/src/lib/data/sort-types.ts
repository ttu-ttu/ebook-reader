/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookCardProps } from '$lib/components/book-card/book-card-props';

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

export interface SortOption {
  property: Exclude<keyof BookCardProps, 'imagePath' | 'isPlaceholder'>;
  direction: SortDirection;
}
