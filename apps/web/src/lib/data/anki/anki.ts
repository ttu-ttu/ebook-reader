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
   * Find cards for multiple words in a single batch request
   * Combines all words into one query for maximum performance
   * @param words - Array of words to search for
   * @param fields - Field names to search in
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Map of word -> card IDs
   */
  async findCardsWithWordsBatch(
    words: string[],
    fields: string[],
    ankiConnectUrl?: string
  ): Promise<Map<string, number[]>> {
    if (!words.length || !fields.length) return new Map();

    // Build regex pattern with all words OR'd together: ^(word1|word2|word3)$
    const escapedWords = words.map((word) => this._escapeRegex(word));
    const regexPattern = `^(${escapedWords.join('|')})$`;

    // Build query with regex for each field
    const fieldQueries = fields.map((field) => `"${field}:re:${regexPattern}"`);
    const combinedQuery = fieldQueries.join(' OR ');
    const query = this._addDeckFilter(combinedQuery);

    // Single findCards request for all words
    const response = await this._executeAction('findCards', { query }, ankiConnectUrl);
    const allCardIds: number[] = response.result || [];

    if (!allCardIds.length) {
      // No cards found for any word
      return new Map(words.map((word) => [word, []]));
    }

    // Get card info to match words to cards
    const cardInfos = await this.cardsInfo(allCardIds, ankiConnectUrl);

    // Map each word to its matching cards
    const resultMap = new Map<string, number[]>();

    for (const word of words) {
      const matchingCardIds: number[] = [];

      for (const cardInfo of cardInfos) {
        // Check if any of the specified fields contain this exact word
        for (const field of fields) {
          const fieldValue = cardInfo.fields[field]?.value;
          if (fieldValue && fieldValue.trim() === word) {
            matchingCardIds.push(cardInfo.cardId);
            break; // Found match in this card, move to next card
          }
        }
      }

      resultMap.set(word, matchingCardIds);
    }

    return resultMap;
  }

  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build a complete card ID -> stability category cache for all cards in configured decks
   * This should be called once on initialization to avoid repeated property queries
   * @param matureThreshold - Stability threshold for mature cards (e.g., 21 days)
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Map of card ID -> category ('mature', 'young', or 'new')
   */
  async buildStabilityCacheForDecks(
    matureThreshold: number,
    ankiConnectUrl?: string
  ): Promise<Map<number, 'mature' | 'young' | 'new'>> {
    const result = new Map<number, 'mature' | 'young' | 'new'>();

    // Build deck query
    let deckQuery = '';
    if (this.wordDeckNames && this.wordDeckNames.length > 0) {
      const deckQueries = this.wordDeckNames.map((deckName) => `"deck:${deckName}"`);
      deckQuery = deckQueries.join(' OR ');
    } else {
      // No deck filter - would query ALL cards
      console.warn('No deck configured for stability cache. Skipping.');
      return result;
    }

    console.log('Building stability cache with threshold:', matureThreshold);

    // Query 1: Find all mature cards in decks (prop:s > threshold)
    const matureQuery = `(${deckQuery}) prop:s>${matureThreshold}`;
    console.log('Querying mature cards:', matureQuery);
    const matureResponse = await this._executeAction(
      'findCards',
      { query: matureQuery },
      ankiConnectUrl
    );
    const matureCardIds: number[] = matureResponse.result || [];
    console.log(`Found ${matureCardIds.length} mature cards`);

    // Query 2: Find all young cards in decks (prop:s <= threshold AND not new)
    const youngQuery = `(${deckQuery}) prop:s<=${matureThreshold} -is:new`;
    console.log('Querying young cards:', youngQuery);
    const youngResponse = await this._executeAction(
      'findCards',
      { query: youngQuery },
      ankiConnectUrl
    );
    const youngCardIds: number[] = youngResponse.result || [];
    console.log(`Found ${youngCardIds.length} young cards`);

    // Query 3: Find all new cards in decks (not reviewed yet)
    const newQuery = `(${deckQuery}) is:new`;
    console.log('Querying new cards:', newQuery);
    const newResponse = await this._executeAction('findCards', { query: newQuery }, ankiConnectUrl);
    const newCardIds: number[] = newResponse.result || [];
    console.log(`Found ${newCardIds.length} new cards`);

    // Build cache
    for (const cardId of matureCardIds) {
      result.set(cardId, 'mature');
    }
    for (const cardId of youngCardIds) {
      result.set(cardId, 'young');
    }
    for (const cardId of newCardIds) {
      result.set(cardId, 'new');
    }

    console.log(
      `Stability cache built: ${matureCardIds.length} mature, ${youngCardIds.length} young, ${newCardIds.length} new`
    );

    return result;
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
   * Get all cards from configured decks for cache warming
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Array of card information with word fields
   */
  async getAllCardsFromDecks(ankiConnectUrl?: string): Promise<CardInfo[]> {
    console.log('getAllCardsFromDecks: Starting...');

    // Build deck query
    let deckQuery = '';
    if (this.wordDeckNames && this.wordDeckNames.length > 0) {
      const deckQueries = this.wordDeckNames.map((deckName) => `"deck:${deckName}"`);
      deckQuery = deckQueries.join(' OR ');
      console.log('getAllCardsFromDecks: Deck query:', deckQuery);
    } else {
      // No deck filter - would return ALL cards, which might be too many
      // Return empty to avoid overwhelming the system
      console.warn('No deck configured for cache warming. Skipping.');
      return [];
    }

    // Find all cards in the configured decks
    console.log('getAllCardsFromDecks: Finding all cards in decks...');
    const response = await this._executeAction('findCards', { query: deckQuery }, ankiConnectUrl);
    const cardIds: number[] = response.result || [];
    console.log(`getAllCardsFromDecks: Found ${cardIds.length} card IDs`);

    if (cardIds.length === 0) {
      return [];
    }

    // Get card info for all cards (in chunks to avoid overwhelming Anki)
    const CHUNK_SIZE = 100;
    const allCardInfos: CardInfo[] = [];
    console.log(`getAllCardsFromDecks: Fetching card info in chunks of ${CHUNK_SIZE}...`);

    for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
      const chunk = cardIds.slice(i, i + CHUNK_SIZE);
      console.log(
        `getAllCardsFromDecks: Fetching chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(cardIds.length / CHUNK_SIZE)}`
      );
      const cardInfos = await this.cardsInfo(chunk, ankiConnectUrl);
      allCardInfos.push(...cardInfos);
    }

    console.log(`getAllCardsFromDecks: Completed, got ${allCardInfos.length} cards with full info`);
    return allCardInfos;
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
