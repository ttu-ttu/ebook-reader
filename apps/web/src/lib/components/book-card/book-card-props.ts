/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

export interface BookCardProps {
  id: number;
  imagePath: string | Blob;
  title: string;
  progress: number;
}
