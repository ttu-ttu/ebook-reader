/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { IDBPDatabase } from 'idb';
import type { AnkiCacheDb } from './factory';
import type { WordStatus } from '$lib/data/anki/token-color';

export type CachedDocumentTokenStatus = 'uncollected' | 'new' | 'young' | 'mature' | 'unknown';

export interface CachedWordData {
  status: WordStatus;
  analysisStatus?: CachedDocumentTokenStatus;
  due?: boolean;
  cardIds: number[];
  expiresAtMs?: number;
}

export interface CachedLemmas {
  lemmas: string[];
  lemmaReadings: string[];
}

/** Cache TTL: 6 hours in milliseconds */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Token panel token-count cache TTL: 30 days in milliseconds */
const DOCUMENT_TOKEN_COUNTS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Service for managing persistent Anki word coloring cache in IndexedDB
 * Implements TTL-based expiration (6 hours)
 */
export class AnkiCacheService {
  constructor(private db: Promise<IDBPDatabase<AnkiCacheDb>>) {}

  /**
   * Get cached word data (status + cardIds) from IndexedDB
   * @param word - Word to lookup
   * @returns Word data if found, undefined otherwise
   */
  async getWordData(word: string): Promise<CachedWordData | undefined> {
    const database = await this.db;
    const entry = await database.get('wordData', word);

    if (!entry) return undefined;

    const status = entry.status === 'low' ? 'due' : entry.status;

    return {
      status,
      analysisStatus: entry.analysisStatus,
      due: entry.due,
      cardIds: Array.isArray(entry.cardIds) ? entry.cardIds : [],
      expiresAtMs:
        typeof entry.expiresAtMs === 'number' && Number.isFinite(entry.expiresAtMs)
          ? entry.expiresAtMs
          : undefined
    };
  }

  /**
   * Get cached word data for multiple words in a single IndexedDB transaction
   * @param words - Words to lookup
   * @returns Map of word -> word data
   */
  async getWordDataBatch(words: string[]): Promise<Map<string, CachedWordData>> {
    const result = new Map<string, CachedWordData>();
    const uniqueWords = Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)));
    if (uniqueWords.length === 0) {
      return result;
    }

    const database = await this.db;
    const tx = database.transaction('wordData', 'readonly');
    const store = tx.objectStore('wordData');
    const entries = await Promise.all(
      uniqueWords.map(async (word) => ({
        word,
        entry: await store.get(word)
      }))
    );

    for (const { word, entry } of entries) {
      if (!entry) {
        continue;
      }

      const status = entry.status === 'low' ? 'due' : entry.status;
      result.set(word, {
        status,
        analysisStatus: entry.analysisStatus,
        due: entry.due,
        cardIds: Array.isArray(entry.cardIds) ? entry.cardIds : [],
        expiresAtMs:
          typeof entry.expiresAtMs === 'number' && Number.isFinite(entry.expiresAtMs)
            ? entry.expiresAtMs
            : undefined
      });
    }

    await tx.done;
    return result;
  }

  async deleteWordData(word: string): Promise<void> {
    const normalizedWord = word.trim();
    if (!normalizedWord) {
      return;
    }

    const database = await this.db;
    await database.delete('wordData', normalizedWord);
  }

  /**
   * Store word data (status + cardIds) in IndexedDB cache
   * @param word - Word to cache
   * @param status - Card status (mature/young/new/due/unknown)
   * @param cardIds - Array of card IDs for this word
   */
  async setWordData(word: string, data: CachedWordData): Promise<void> {
    const database = await this.db;
    await database.put('wordData', {
      word,
      status: data.status,
      analysisStatus: data.analysisStatus,
      due: data.due,
      cardIds: data.cardIds,
      timestamp: Date.now(),
      expiresAtMs:
        typeof data.expiresAtMs === 'number' && Number.isFinite(data.expiresAtMs)
          ? data.expiresAtMs
          : undefined
    });
  }

  /**
   * Store multiple wordData entries in a single IndexedDB transaction
   * @param entries - Array of word -> data entries
   */
  async setWordDataBatch(entries: Array<{ word: string; data: CachedWordData }>): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const database = await this.db;
    const tx = database.transaction('wordData', 'readwrite');
    const store = tx.objectStore('wordData');
    const timestamp = Date.now();

    await Promise.all(
      entries.map(async ({ word, data }) => {
        const normalizedWord = word.trim();
        if (!normalizedWord) {
          return;
        }

        await store.put({
          word: normalizedWord,
          status: data.status,
          analysisStatus: data.analysisStatus,
          due: data.due,
          cardIds: data.cardIds,
          timestamp,
          expiresAtMs:
            typeof data.expiresAtMs === 'number' && Number.isFinite(data.expiresAtMs)
              ? data.expiresAtMs
              : undefined
        });
      })
    );

    await tx.done;
  }

  /**
   * Get cached tokenization result from IndexedDB
   * @param text - Text to lookup
   * @returns Array of tokens if found and not expired, undefined otherwise
   */
  async getTokens(text: string): Promise<string[] | undefined> {
    const database = await this.db;
    const entry = await database.get('tokenize', text);

    if (!entry) return undefined;
    if (this._isExpired(entry.timestamp)) {
      await database.delete('tokenize', text);
      return undefined;
    }

    return entry.tokens;
  }

  /**
   * Store tokenization result in IndexedDB cache
   * @param text - Original text
   * @param tokens - Array of tokens
   */
  async setTokens(text: string, tokens: string[]): Promise<void> {
    const database = await this.db;
    await database.put('tokenize', {
      text,
      tokens,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached lemmatization result from IndexedDB
   * @param token - Token to lookup
   * @returns Array of lemmas if found and not expired, undefined otherwise
   */
  async getLemmas(token: string): Promise<CachedLemmas | undefined> {
    const database = await this.db;
    const entry = await database.get('lemmatize', token);

    if (!entry) return undefined;
    if (this._isExpired(entry.timestamp)) {
      await database.delete('lemmatize', token);
      return undefined;
    }

    const lemmas = Array.isArray(entry.lemmas)
      ? Array.from(new Set(entry.lemmas.map((lemma) => lemma.trim()).filter(Boolean)))
      : [];
    const lemmaReadings = Array.isArray(entry.lemmaReadings)
      ? Array.from(new Set(entry.lemmaReadings.map((lemma) => lemma.trim()).filter(Boolean)))
      : [];
    if (lemmas.length === 0 && lemmaReadings.length === 0) {
      await database.delete('lemmatize', token);
      return undefined;
    }

    return { lemmas, lemmaReadings };
  }

  /**
   * Get cached lemmatization for multiple tokens in a single IndexedDB transaction
   * @param tokens - Tokens to lookup
   * @returns Map of token -> lemmas
   */
  async getLemmasBatch(tokens: string[]): Promise<Map<string, CachedLemmas>> {
    const result = new Map<string, CachedLemmas>();
    const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)));
    if (uniqueTokens.length === 0) {
      return result;
    }

    const database = await this.db;
    const tx = database.transaction('lemmatize', 'readwrite');
    const store = tx.objectStore('lemmatize');
    const entries = await Promise.all(
      uniqueTokens.map(async (token) => ({
        token,
        entry: await store.get(token)
      }))
    );

    for (const { token, entry } of entries) {
      if (!entry) {
        continue;
      }

      if (this._isExpired(entry.timestamp)) {
        await store.delete(token);
        continue;
      }

      const lemmas = Array.isArray(entry.lemmas)
        ? Array.from(new Set(entry.lemmas.map((lemma) => lemma.trim()).filter(Boolean)))
        : [];
      const lemmaReadings = Array.isArray(entry.lemmaReadings)
        ? Array.from(new Set(entry.lemmaReadings.map((lemma) => lemma.trim()).filter(Boolean)))
        : [];
      if (lemmas.length === 0 && lemmaReadings.length === 0) {
        await store.delete(token);
        continue;
      }

      result.set(token, { lemmas, lemmaReadings });
    }

    await tx.done;
    return result;
  }

  /**
   * Store lemmatization result in IndexedDB cache
   * @param token - Token
   * @param lemmas - Lemma and lemma-reading arrays
   */
  async setLemmas(token: string, lemmas: CachedLemmas): Promise<void> {
    const database = await this.db;
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return;
    }

    const normalizedLemmas = Array.from(
      new Set((lemmas.lemmas || []).map((lemma) => lemma.trim()).filter(Boolean))
    );
    const normalizedLemmaReadings = Array.from(
      new Set((lemmas.lemmaReadings || []).map((lemma) => lemma.trim()).filter(Boolean))
    );
    if (normalizedLemmas.length === 0 && normalizedLemmaReadings.length === 0) {
      await database.delete('lemmatize', normalizedToken);
      return;
    }

    await database.put('lemmatize', {
      token: normalizedToken,
      lemmas: normalizedLemmas,
      lemmaReadings: normalizedLemmaReadings,
      timestamp: Date.now()
    });
  }

  /**
   * Store multiple lemmatization results in a single IndexedDB transaction
   * @param entries - Token -> lemmas entries
   */
  async setLemmasBatch(
    entries: Array<{ token: string; lemmas: string[]; lemmaReadings?: string[] }>
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const database = await this.db;
    const tx = database.transaction('lemmatize', 'readwrite');
    const store = tx.objectStore('lemmatize');
    const timestamp = Date.now();

    await Promise.all(
      entries.map(async ({ token, lemmas, lemmaReadings }) => {
        const normalizedToken = token.trim();
        if (!normalizedToken) {
          return;
        }

        const normalizedLemmas = Array.from(
          new Set(lemmas.map((lemma) => lemma.trim()).filter(Boolean))
        );
        const normalizedLemmaReadings = Array.from(
          new Set((lemmaReadings || []).map((lemma) => lemma.trim()).filter(Boolean))
        );
        if (normalizedLemmas.length === 0 && normalizedLemmaReadings.length === 0) {
          return;
        }

        await store.put({
          token: normalizedToken,
          lemmas: normalizedLemmas,
          lemmaReadings: normalizedLemmaReadings,
          timestamp
        });
      })
    );

    await tx.done;
  }

  /**
   * Get cached termEntries (dictionary data) from IndexedDB
   * @param token - Token to lookup
   * @returns Full dictionaryEntries array if found and not expired, undefined otherwise
   */
  async getTermEntries(token: string): Promise<any | undefined> {
    const database = await this.db;
    const entry = await database.get('termEntries', token);

    if (!entry) return undefined;
    if (this._isExpired(entry.timestamp)) {
      await database.delete('termEntries', token);
      return undefined;
    }

    return entry.entries;
  }

  /**
   * Store termEntries (dictionary data) in IndexedDB cache
   * @param token - Token
   * @param entries - Full dictionaryEntries array from Yomitan
   */
  async setTermEntries(token: string, entries: any): Promise<void> {
    const database = await this.db;
    await database.put('termEntries', {
      token,
      entries,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached document token counts used by token panel analysis
   * @param key - Document signature key
   * @returns Token counts + total token count if found and not expired
   */
  async getDocumentTokenCounts(
    key: string
  ): Promise<{ entries: { token: string; count: number }[]; totalTokens: number } | undefined> {
    const database = await this.db;
    const entry = await database.get('documentTokenCounts', key);

    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > DOCUMENT_TOKEN_COUNTS_TTL_MS) {
      await database.delete('documentTokenCounts', key);
      return undefined;
    }

    return {
      entries: Array.isArray(entry.entries) ? entry.entries : [],
      totalTokens: Number.isFinite(entry.totalTokens) ? entry.totalTokens : 0
    };
  }

  /**
   * Store document token counts used by token panel analysis
   * @param key - Document signature key
   * @param entries - Token frequency entries
   * @param totalTokens - Total number of tokens in the document
   */
  async setDocumentTokenCounts(
    key: string,
    entries: { token: string; count: number }[],
    totalTokens: number
  ): Promise<void> {
    const database = await this.db;
    await database.put('documentTokenCounts', {
      key,
      entries,
      totalTokens,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cache stores
   */
  async clearAllCaches(): Promise<void> {
    const database = await this.db;
    const tx = database.transaction(
      ['wordData', 'tokenize', 'lemmatize', 'termEntries', 'documentTokenCounts'],
      'readwrite'
    );

    await Promise.all([
      tx.objectStore('wordData').clear(),
      tx.objectStore('tokenize').clear(),
      tx.objectStore('lemmatize').clear(),
      tx.objectStore('termEntries').clear(),
      tx.objectStore('documentTokenCounts').clear()
    ]);

    await tx.done;
  }

  /**
   * Get statistics about cache usage
   * @returns Object with entry counts for each cache store
   */
  async getCacheStats(): Promise<{
    wordDataCount: number;
    tokenizeCount: number;
    lemmatizeCount: number;
    termEntriesCount: number;
    documentTokenCountsCount: number;
  }> {
    const database = await this.db;
    const [
      wordDataCount,
      tokenizeCount,
      lemmatizeCount,
      termEntriesCount,
      documentTokenCountsCount
    ] = await Promise.all([
      database.count('wordData'),
      database.count('tokenize'),
      database.count('lemmatize'),
      database.count('termEntries'),
      database.count('documentTokenCounts')
    ]);

    return {
      wordDataCount,
      tokenizeCount,
      lemmatizeCount,
      termEntriesCount,
      documentTokenCountsCount
    };
  }

  /**
   * Check if a timestamp is expired based on TTL
   * @param timestamp - Timestamp to check (milliseconds since epoch)
   * @returns True if expired, false otherwise
   */
  private _isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > CACHE_TTL_MS;
  }

  private _isWordDataExpired(entry: { timestamp: number; expiresAtMs?: number }): boolean {
    if (typeof entry.expiresAtMs === 'number' && Number.isFinite(entry.expiresAtMs)) {
      return Date.now() >= entry.expiresAtMs;
    }

    return this._isExpired(entry.timestamp);
  }
}
