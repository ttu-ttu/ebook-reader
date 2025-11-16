/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Anki Connect API client for card information and interval data
 * Based on asbplayer implementation: https://github.com/ShanaryS/asbplayer/tree/yomitan-anki
 */

export interface CardInfo {
  cardId: number;
  interval: number;
  fields: Record<string, { value: string }>;
}

export class Anki {
  private readonly ankiConnectUrl: string;
  private readonly wordFields: string[];
  private readonly wordDeckNames: string[];

  constructor(
    ankiConnectUrl = 'http://127.0.0.1:8765',
    wordFields: string[] = ['Word', 'Expression'],
    wordDeckNames: string[] = []
  ) {
    this.ankiConnectUrl = ankiConnectUrl;
    this.wordFields = wordFields;
    this.wordDeckNames = wordDeckNames;
  }

  getWordFields(): string[] {
    return this.wordFields;
  }

  getWordDecks(): string[] {
    return this.wordDeckNames;
  }

  /**
   * Find cards with exact word match in specified fields
   * @param word - Word to search for (exact match)
   * @param fields - Field names to search in
   * @param decks - Deck names to filter by
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Array of card IDs
   */
  async findCardsWithWord(
    word: string,
    fields: string[],
    ankiConnectUrl?: string
  ): Promise<number[]> {
    if (!fields.length) return [];

    const fieldQuery = fields.map((field) => `"${field}:${word}"`).join(' OR ');
    const query = this._addDeckFilter(fieldQuery);
    // const escapedQuery = this._escapeQuery(query);
    const response = await this._executeAction('findCards', { query }, ankiConnectUrl);

    return response.result || [];
  }

  /**
   * Get detailed information for multiple cards
   * @param cardIds - Array of card IDs
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Array of card information including intervals and fields
   */
  async cardsInfo(cardIds: number[], ankiConnectUrl?: string): Promise<CardInfo[]> {
    if (!cardIds.length) return [];

    const response = await this._executeAction('cardsInfo', { cards: cardIds }, ankiConnectUrl);

    return response.result || [];
  }

  /**
   * Get just the intervals for specified cards
   * @param cardIds - Array of card IDs
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Array of intervals in days
   */
  async currentIntervals(cardIds: number[], ankiConnectUrl?: string): Promise<number[]> {
    const infos = await this.cardsInfo(cardIds, ankiConnectUrl);
    return infos.map((info) => info.interval);
  }

  /**
   * Test connection to Anki Connect
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Anki Connect version number
   */
  async version(ankiConnectUrl?: string): Promise<number> {
    const response = await this._executeAction('version', {}, ankiConnectUrl);
    return response.result;
  }

  /**
   * Escape special characters in Anki search query
   * @param query - Query string to escape
   * @returns Escaped query string
   */
  private _escapeQuery(query: string): string {
    // Remove characters that have special meaning in Anki search
    return query.replace(/([ :"*_])/g, '$1');
  }

  /**
   * Add deck filter to query if deck name is specified
   * @param query - Base query string
   * @returns Query with deck filter added
   */
  private _addDeckFilter(query: string): string {
    if (!this.wordDeckNames || this.wordDeckNames.length === 0) {
      return query;
    }
    const deckQuery = this.wordDeckNames.map((deckName) => `"deck:${deckName}"`).join(' OR ');
    // Wrap in parentheses and add deck filter
    return `(${deckQuery}) (${query})`;
  }

  /**
   * Execute an action against Anki Connect API
   * @param action - Anki Connect action name
   * @param params - Action parameters
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns API response
   * @throws Error if request fails or returns error
   */
  private async _executeAction(action: string, params: any, ankiConnectUrl?: string): Promise<any> {
    const url = ankiConnectUrl || this.ankiConnectUrl;

    // AnkiConnect supports CORS, but use text/plain to be consistent and avoid preflight
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action,
        version: 6,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`Anki Connect request failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    if (json.error) {
      throw new Error(`Anki Connect error: ${json.error}`);
    }

    return json;
  }
}
