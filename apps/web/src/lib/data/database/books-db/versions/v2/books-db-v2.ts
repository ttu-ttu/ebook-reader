/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import type { DBSchema } from 'idb';

export default interface BooksDbV2 extends DBSchema {
  keyvaluepairs: {
    key: string;
    value: string;
  };
  'local-forage-detect-blob-support': {
    key: string;
    value: string;
  };
}
