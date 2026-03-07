/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { IDBPDatabase } from 'idb';
import type { AnkiCacheDb } from './factory';
import type { TokenColor, WordStatus } from '$lib/data/anki/token-color';

/** Cache TTL: 6 hours in milliseconds */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Service for managing persistent Anki word coloring cache in IndexedDB
 * Implements TTL-based expiration (6 hours)
 */
export class AnkiCacheService {
  constructor(private db: Promise<IDBPDatabase<AnkiCacheDb>>) {}

  /**
   * Get cached word data (status + cardIds) from IndexedDB
   * @param word - Word to lookup
   * @returns Word data if found and not expired, undefined otherwise
   */
  async getWordData(word: string): Promise<{ status: WordStatus; cardIds: number[] } | undefined> {
    const database = await this.db;
    const entry = await database.get('wordData', word);

    if (!entry) return undefined;
    if (this._isExpired(entry.timestamp)) {
      await database.delete('wordData', word);
      return undefined;
    }

    return { status: entry.status, cardIds: entry.cardIds };
  }

  /**
   * Store word data (status + cardIds) in IndexedDB cache
   * @param word - Word to cache
   * @param status - Card status (mature/young/new/low/unknown)
   * @param cardIds - Array of card IDs for this word
   */
  async setWordData(word: string, status: WordStatus, cardIds: number[]): Promise<void> {
    const database = await this.db;
    await database.put('wordData', {
      word,
      status,
      cardIds,
      timestamp: Date.now()
    });
  }

  /**
   * Store token color in IndexedDB cache
   * @param token - Token to cache
   * @param color - Token color
   * @param status - Optional card status
   */
  async setTokenColor(token: string, color: TokenColor, status?: WordStatus): Promise<void> {
    const database = await this.db;
    await database.put('tokenColor', {
      token,
      color,
      status,
      timestamp: Date.now()
    });
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
  async getLemmas(token: string): Promise<string[] | undefined> {
    const database = await this.db;
    const entry = await database.get('lemmatize', token);

    if (!entry) return undefined;
    if (this._isExpired(entry.timestamp)) {
      await database.delete('lemmatize', token);
      return undefined;
    }

    return entry.lemmas;
  }

  /**
   * Store lemmatization result in IndexedDB cache
   * @param token - Token
   * @param lemmas - Array of lemmatized forms
   */
  async setLemmas(token: string, lemmas: string[]): Promise<void> {
    const database = await this.db;
    await database.put('lemmatize', {
      token,
      lemmas,
      timestamp: Date.now()
    });
  }

  /**
   * Store card IDs for a token
   * @param token - Token
   * @param cardIds - Array of card IDs
   */
  async setTokenCardIds(token: string, cardIds: number[]): Promise<void> {
    const database = await this.db;
    await database.put('tokenCardIds', {
      token,
      cardIds,
      timestamp: Date.now()
    });
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
   * Clear all cache stores
   */
  async clearAllCaches(): Promise<void> {
    const database = await this.db;
    const tx = database.transaction(
      ['wordData', 'tokenColor', 'tokenCardIds', 'tokenize', 'lemmatize', 'termEntries'],
      'readwrite'
    );

    await Promise.all([
      tx.objectStore('wordData').clear(),
      tx.objectStore('tokenColor').clear(),
      tx.objectStore('tokenCardIds').clear(),
      tx.objectStore('tokenize').clear(),
      tx.objectStore('lemmatize').clear(),
      tx.objectStore('termEntries').clear()
    ]);

    await tx.done;
  }

  /**
   * Get statistics about cache usage
   * @returns Object with entry counts for each cache store
   */
  async getCacheStats(): Promise<{
    wordDataCount: number;
    tokenColorCount: number;
    tokenCardIdsCount: number;
    tokenizeCount: number;
    lemmatizeCount: number;
    termEntriesCount: number;
  }> {
    const database = await this.db;
    const [
      wordDataCount,
      tokenColorCount,
      tokenCardIdsCount,
      tokenizeCount,
      lemmatizeCount,
      termEntriesCount
    ] = await Promise.all([
      database.count('wordData'),
      database.count('tokenColor'),
      database.count('tokenCardIds'),
      database.count('tokenize'),
      database.count('lemmatize'),
      database.count('termEntries')
    ]);

    return {
      wordDataCount,
      tokenColorCount,
      tokenCardIdsCount,
      tokenizeCount,
      lemmatizeCount,
      termEntriesCount
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
}
