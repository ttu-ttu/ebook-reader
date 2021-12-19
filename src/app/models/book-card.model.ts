/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Subject } from 'rxjs';

export default interface BookCard {
  id: number;
  imagePath: Subject<string | Blob | undefined>;
  title: string;
  progress: number;
}
