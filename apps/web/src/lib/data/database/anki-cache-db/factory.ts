/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { openDB, type DBSchema } from 'idb';
import type { TokenColor, WordStatus } from '$lib/data/anki/token-color';

type PersistedWordStatus = WordStatus | 'low';

type CachedDocumentTokenStatus = 'uncollected' | 'new' | 'young' | 'mature' | 'unknown';

/**
 * IndexedDB schema for Anki word coloring cache
 * Stores tokenization, lemmatization, and card retrievability results
 */
export interface AnkiCacheDb extends DBSchema {
  /** Cache for word -> card data (status + cardIds) */
  wordData: {
    key: string;
    value: {
      word: string;
      status: PersistedWordStatus;
      analysisStatus?: CachedDocumentTokenStatus;
      due?: boolean;
      cardIds: number[];
      timestamp: number;
    };
  };
  /** @deprecated Legacy cache - use wordData instead */
  tokenColor: {
    key: string;
    value: {
      token: string;
      color: TokenColor;
      status?: PersistedWordStatus;
      timestamp: number;
    };
  };
  /** @deprecated Legacy cache - use wordData instead */
  tokenCardIds: {
    key: string;
    value: {
      token: string;
      cardIds: number[];
      timestamp: number;
    };
  };
  /** Cache for Yomitan tokenization results */
  tokenize: {
    key: string;
    value: {
      text: string;
      tokens: string[];
      timestamp: number;
    };
  };
  /** Cache for Yomitan lemmatization (deinflection) results */
  lemmatize: {
    key: string;
    value: {
      token: string;
      lemmas: string[];
      timestamp: number;
    };
  };
  /** Cache for full Yomitan termEntries responses (dictionary data) */
  termEntries: {
    key: string;
    value: {
      token: string;
      entries: any; // Full dictionaryEntries array from Yomitan
      timestamp: number;
    };
  };
  /** Cache for document-level token frequencies used by the token panel */
  documentTokenCounts: {
    key: string;
    value: {
      key: string;
      entries: { token: string; count: number }[];
      totalTokens: number;
      timestamp: number;
    };
  };
}

/**
 * Create and initialize the Anki cache database
 * @param name - Database name (default: 'anki-cache')
 * @returns Promise resolving to database instance
 */
export function createAnkiCacheDb(name = 'anki-cache') {
  return openDB<AnkiCacheDb>(name, 5, {
    upgrade(db, oldVersion) {
      // Version 1: Initial stores
      if (oldVersion < 1) {
        db.createObjectStore('tokenColor', { keyPath: 'token' });
        db.createObjectStore('tokenize', { keyPath: 'text' });
        db.createObjectStore('lemmatize', { keyPath: 'token' });
      }

      // Version 2: Add tokenCardIds store
      if (oldVersion < 2) {
        db.createObjectStore('tokenCardIds', { keyPath: 'token' });
      }

      // Version 3: Add termEntries store
      if (oldVersion < 3) {
        db.createObjectStore('termEntries', { keyPath: 'token' });
      }

      // Version 4: Add wordData store (combines status + cardIds)
      if (oldVersion < 4) {
        db.createObjectStore('wordData', { keyPath: 'word' });
      }

      // Version 5: Add documentTokenCounts store (token panel frequency snapshots)
      if (oldVersion < 5) {
        db.createObjectStore('documentTokenCounts', { keyPath: 'key' });
      }
    }
  });
}
