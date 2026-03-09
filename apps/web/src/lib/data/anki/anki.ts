/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Anki Connect API client for card information and retrievability data
 * Based on asbplayer implementation: https://github.com/ShanaryS/asbplayer/tree/yomitan-anki
 */
import type { ResolvedWordStatus } from './token-color';

export type CardMetricField = 'prop:r' | 'prop:s' | 'prop:d';
export type RetrievedInfoMode = 'FIELDS_ONLY' | 'COMPACT' | 'ALL';

export interface CardsInfoOptions {
  noteFields?: string[];
  compact?: boolean;
  retrievedInfoMode?: RetrievedInfoMode;
}

export interface CardInfo {
  cardId: number;
  interval?: number;
  fields: Record<string, { value: string }>;
  'prop:r'?: number | null;
  'prop:s'?: number | null;
  'prop:d'?: number | null;
  deckName?: string;
  due?: number;
  queue?: number;
  type?: number;
  reps?: number;
  lapses?: number;
  factor?: number;
  mod?: number;
  note?: number;
}

export interface GuiCurrentCardInfo {
  cardId: number;
  buttons: number[];
}

export interface CardReviewInfo {
  id: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

export interface CardMetricInfo {
  cardId: number;
  'prop:r': number | null;
  'prop:s': number | null;
  'prop:d': number | null;
}

export interface GetAllCardsProgress {
  phase: 'query-detailed' | 'find-card-ids' | 'fetch-card-info';
  percentage: number;
  completed: number;
  total: number;
  detail: string;
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
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build a complete card ID -> retrievability category cache for all cards in configured decks
   * This should be called once on initialization to avoid repeated property queries.
   * Thresholds:
   * - `mature`: retrievability > 0.9
   * - `young`: reviewed cards with retrievability >= desiredRetention and <= 0.9
   * - `new`: brand-new cards (`is:new`)
   * - `due`: retrievability < desiredRetention
   * @param desiredRetention - Decimal retrievability threshold for due/new split
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Map of card ID -> category
   */
  async buildRetrievabilityCacheForDecks(
    desiredRetention = 0.6,
    ankiConnectUrl?: string
  ): Promise<Map<number, ResolvedWordStatus>> {
    const result = new Map<number, ResolvedWordStatus>();
    const retention = Math.min(1, Math.max(0, desiredRetention));

    // Build deck query
    let deckQuery = '';
    if (this.wordDeckNames && this.wordDeckNames.length > 0) {
      const deckQueries = this.wordDeckNames.map((deckName) => `"deck:${deckName}"`);
      deckQuery = deckQueries.join(' OR ');
    } else {
      // No deck filter - would query ALL cards
      console.warn('No deck configured for retrievability cache. Skipping.');
      return result;
    }

    console.log(
      `Building retrievability cache with thresholds: >0.9, >=${retention}, <${retention}`
    );

    // Query 1: Find all mature cards in decks (prop:r > 0.9)
    const matureQuery = `(${deckQuery}) prop:r>0.9`;
    console.log('Querying mature cards:', matureQuery);
    const matureResponse = await this._executeAction(
      'findCards',
      { query: matureQuery },
      ankiConnectUrl
    );
    const matureCardIds: number[] = matureResponse.result || [];
    console.log(`Found ${matureCardIds.length} mature cards`);

    // Query 2: Find all young reviewed cards in decks (desiredRetention <= prop:r <= 0.9)
    const youngQuery = `(${deckQuery}) prop:r>=${retention} -prop:r>0.9 -is:new`;
    console.log('Querying young cards:', youngQuery);
    const youngResponse = await this._executeAction(
      'findCards',
      { query: youngQuery },
      ankiConnectUrl
    );
    const youngCardIds: number[] = youngResponse.result || [];
    console.log(`Found ${youngCardIds.length} young cards`);

    // Query 3: Find brand-new cards in decks.
    const newQuery = `(${deckQuery}) is:new`;
    console.log('Querying new cards:', newQuery);
    const newResponse = await this._executeAction('findCards', { query: newQuery }, ankiConnectUrl);
    const newCardIds: number[] = newResponse.result || [];
    console.log(`Found ${newCardIds.length} new cards`);

    // Query 4: Find all due cards in decks (prop:r < desiredRetention), excluding brand-new cards
    const dueQuery = `(${deckQuery}) prop:r<${retention} -is:new`;
    console.log('Querying due cards:', dueQuery);
    const dueResponse = await this._executeAction('findCards', { query: dueQuery }, ankiConnectUrl);
    const dueCardIds: number[] = dueResponse.result || [];
    console.log(`Found ${dueCardIds.length} due cards`);

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
    for (const cardId of dueCardIds) {
      result.set(cardId, 'due');
    }

    console.log(
      `Retrievability cache built: ${matureCardIds.length} mature, ${youngCardIds.length} young, ${newCardIds.length} new, ${dueCardIds.length} due`
    );

    return result;
  }

  /**
   * @deprecated Use buildRetrievabilityCacheForDecks instead.
   */
  async buildStabilityCacheForDecks(
    _matureThreshold: number,
    ankiConnectUrl?: string
  ): Promise<Map<number, ResolvedWordStatus>> {
    return this.buildRetrievabilityCacheForDecks(0.6, ankiConnectUrl);
  }

  /**
   * Get detailed information for multiple cards
   * @param cardIds - Array of card IDs
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Array of card information including intervals and fields
   */
  async cardsInfo(
    cardIds: number[],
    fields?: CardMetricField[],
    ankiConnectUrl?: string,
    options?: CardsInfoOptions
  ): Promise<CardInfo[]> {
    if (!cardIds.length) return [];

    const params: {
      cards: number[];
      fields?: CardMetricField[];
      noteFields?: string[];
      compact?: boolean;
      retrieved_info_mode?: RetrievedInfoMode;
    } = { cards: cardIds };

    if (fields && fields.length > 0) {
      params.fields = fields;
    }

    if (options?.noteFields && options.noteFields.length > 0) {
      params.noteFields = options.noteFields;
    }

    if (typeof options?.compact === 'boolean') {
      params.compact = options.compact;
    }

    if (options?.retrievedInfoMode) {
      params.retrieved_info_mode = options.retrievedInfoMode;
    }

    const response = await this._executeAction('cardsInfo', params, ankiConnectUrl);

    return response.result || [];
  }

  async getReviewsOfCards(
    cards: number[],
    ankiConnectUrl?: string
  ): Promise<Record<string, CardReviewInfo[]>> {
    if (!cards.length) return {};

    const response = await this._executeAction('getReviewsOfCards', { cards }, ankiConnectUrl);
    return response.result || {};
  }

  /**
   * Get just the intervals for specified cards
   * @param cardIds - Array of card IDs
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Array of intervals in days
   */
  async currentIntervals(cardIds: number[], ankiConnectUrl?: string): Promise<number[]> {
    const infos = await this.cardsInfo(cardIds, undefined, ankiConnectUrl);
    return infos
      .map((info) => info.interval)
      .filter((interval): interval is number => typeof interval === 'number');
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

  async guiCurrentCard(ankiConnectUrl?: string): Promise<GuiCurrentCardInfo | null> {
    const response = await this._executeAction('guiCurrentCard', {}, ankiConnectUrl);
    return response.result || null;
  }

  async guiShowAnswer(ankiConnectUrl?: string): Promise<boolean> {
    const response = await this._executeAction('guiShowAnswer', {}, ankiConnectUrl);
    return !!response.result;
  }

  async guiAnswerCard(ease: 1 | 2 | 3 | 4, ankiConnectUrl?: string): Promise<boolean> {
    const response = await this._executeAction('guiAnswerCard', { ease }, ankiConnectUrl);
    return !!response.result;
  }

  async gradeNow(cards: number[], ease: 1 | 2 | 3 | 4, ankiConnectUrl?: string): Promise<boolean> {
    const response = await this._executeAction('gradeNow', { cards, ease }, ankiConnectUrl);
    return !!response.result;
  }

  async guiBrowse(query: string, ankiConnectUrl?: string): Promise<number[]> {
    const response = await this._executeAction('guiBrowse', { query }, ankiConnectUrl);
    return response.result || [];
  }

  async isCardNew(cardId: number, ankiConnectUrl?: string): Promise<boolean> {
    const response = await this._executeAction(
      'findCards',
      { query: `cid:${cardId} is:new` },
      ankiConnectUrl
    );
    return Array.isArray(response.result) && response.result.length > 0;
  }

  /**
   * Estimate a card's exact retrievability (prop:r) using binary search queries.
   * Returns undefined for brand-new cards that do not have retrievability yet.
   */
  async cardRetrievability(
    cardId: number,
    decimals = 3,
    checkIfNew = true,
    ankiConnectUrl?: string
  ): Promise<number | undefined> {
    try {
      const map = await this.cardRetrievabilityMap([cardId], ankiConnectUrl);
      if (map.has(cardId)) {
        const value = map.get(cardId);
        if (typeof value === 'number') {
          const rounded = Number(value.toFixed(decimals));
          return Number.isFinite(rounded) ? rounded : undefined;
        }

        if (checkIfNew && (await this.isCardNew(cardId, ankiConnectUrl))) {
          return undefined;
        }

        return undefined;
      }
    } catch {
      // Fall back to query-based estimation below.
    }

    if (checkIfNew && (await this.isCardNew(cardId, ankiConnectUrl))) {
      return undefined;
    }

    let low = 0;
    let high = 1;
    const iterations = Math.max(12, Math.min(20, decimals * 4 + 2));
    const queryDecimals = Math.min(6, Math.max(3, decimals + 2));

    for (let i = 0; i < iterations; i++) {
      const mid = (low + high) / 2;
      const threshold = mid.toFixed(queryDecimals);
      const response = await this._executeAction(
        'findCards',
        { query: `cid:${cardId} prop:r>${threshold}` },
        ankiConnectUrl
      );
      const isAbove = Array.isArray(response.result) && response.result.length > 0;

      if (isAbove) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const rounded = Number(low.toFixed(decimals));
    return Number.isFinite(rounded) ? rounded : undefined;
  }

  /**
   * Fetch current retrievability for cards in one request.
   * Requires AnkiConnect findCards(fields=["prop:r"]) support.
   */
  async cardRetrievabilityMap(
    cardIds: number[],
    ankiConnectUrl?: string
  ): Promise<Map<number, number | null>> {
    const metrics = await this.cardMetricsMap(cardIds, ['prop:r'], ankiConnectUrl);
    const result = new Map<number, number | null>();
    for (const [cardId, metric] of metrics.entries()) {
      result.set(cardId, metric['prop:r']);
    }

    return result;
  }

  async cardMetricsMap(
    cardIds: number[],
    fields: CardMetricField[] = ['prop:r', 'prop:s'],
    ankiConnectUrl?: string
  ): Promise<Map<number, CardMetricInfo>> {
    const result = new Map<number, CardMetricInfo>();
    const uniqueCardIds = Array.from(new Set(cardIds.filter((id) => Number.isFinite(id))));
    if (uniqueCardIds.length === 0) {
      return result;
    }

    const QUERY_CHUNK_SIZE = 250;

    for (let index = 0; index < uniqueCardIds.length; index += QUERY_CHUNK_SIZE) {
      const chunk = uniqueCardIds.slice(index, index + QUERY_CHUNK_SIZE);
      const query = `(${chunk.map((id) => `cid:${id}`).join(' OR ')})`;
      const response = await this._executeAction('findCards', { query, fields }, ankiConnectUrl);

      if (!Array.isArray(response.result)) {
        throw new Error('Unexpected findCards(fields) response payload.');
      }

      for (const entry of response.result) {
        if (!entry || typeof entry !== 'object') {
          throw new Error('findCards(fields) is not supported by this AnkiConnect build.');
        }

        const values = entry as Record<string, unknown>;
        const cardId = Number(values.cardId);
        if (!Number.isFinite(cardId)) {
          continue;
        }

        result.set(cardId, {
          cardId,
          'prop:r': typeof values['prop:r'] === 'number' ? (values['prop:r'] as number) : null,
          'prop:s': typeof values['prop:s'] === 'number' ? (values['prop:s'] as number) : null,
          'prop:d': typeof values['prop:d'] === 'number' ? (values['prop:d'] as number) : null
        });
      }
    }

    return result;
  }

  /**
   * Get all cards from configured decks for cache warming
   * @param ankiConnectUrl - Optional override for Anki Connect URL
   * @returns Array of card information with word fields
   */
  async getAllCardsFromDecks(
    ankiConnectUrl?: string,
    metricFields: CardMetricField[] = ['prop:r', 'prop:s'],
    onProgress?: (progress: GetAllCardsProgress) => void
  ): Promise<CardInfo[]> {
    console.log('getAllCardsFromDecks: Starting...');

    const reportProgress = (progress: GetAllCardsProgress) => {
      onProgress?.(progress);
    };

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

    const requestedMetricFields = metricFields.length > 0 ? metricFields : undefined;

    // Fast path: query-based detailed findCards (no card-id round-trip).
    reportProgress({
      phase: 'query-detailed',
      percentage: 0,
      completed: 0,
      total: 1,
      detail: 'Trying query-based detailed fetch'
    });
    const queryBasedCards = await this._findCardsDetailedByQuery(
      deckQuery,
      requestedMetricFields,
      ankiConnectUrl
    );
    if (queryBasedCards !== null) {
      reportProgress({
        phase: 'query-detailed',
        percentage: 100,
        completed: 1,
        total: 1,
        detail: `Fetched ${queryBasedCards.length} cards via query`
      });
      console.log(
        `getAllCardsFromDecks: Query-based findCards path returned ${queryBasedCards.length} cards`
      );
      return queryBasedCards;
    }

    // Find all cards in the configured decks
    console.log('getAllCardsFromDecks: Finding all cards in decks...');
    const response = await this._executeAction('findCards', { query: deckQuery }, ankiConnectUrl);
    const cardIds: number[] = response.result || [];
    console.log(`getAllCardsFromDecks: Found ${cardIds.length} card IDs`);

    const CHUNK_SIZE = 2500;
    const totalChunks = cardIds.length > 0 ? Math.ceil(cardIds.length / CHUNK_SIZE) : 0;
    const totalSteps = 1 + totalChunks;
    reportProgress({
      phase: 'find-card-ids',
      percentage: totalSteps > 0 ? Math.round((1 / totalSteps) * 100) : 100,
      completed: 1,
      total: totalSteps,
      detail: `Found ${cardIds.length} card IDs`
    });

    if (cardIds.length === 0) {
      return [];
    }

    // Get card info for all cards (in chunks to avoid overwhelming Anki)
    const allCardInfos: CardInfo[] = [];
    let useRetrievedInfoMode = true;
    let useLegacyCompactCardsInfo = true;
    console.log(`getAllCardsFromDecks: Fetching card info in chunks of ${CHUNK_SIZE}...`);

    for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
      const chunk = cardIds.slice(i, i + CHUNK_SIZE);
      console.log(
        `getAllCardsFromDecks: Fetching chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(cardIds.length / CHUNK_SIZE)}`
      );

      let cardInfos: CardInfo[] = [];

      if (useRetrievedInfoMode) {
        try {
          cardInfos = await this.cardsInfo(chunk, requestedMetricFields, ankiConnectUrl, {
            noteFields: this.wordFields,
            retrievedInfoMode: 'FIELDS_ONLY'
          });

          if (!this._hasUsableWarmCacheCards(cardInfos)) {
            useRetrievedInfoMode = false;
            console.warn(
              'cardsInfo FIELDS_ONLY returned unusable warm-cache payload; trying legacy compact mode.'
            );
          }
        } catch (error) {
          if (!this._isUnsupportedRetrievedInfoModeError(error)) {
            throw error;
          }

          useRetrievedInfoMode = false;
          console.warn(
            'cardsInfo retrieved_info_mode not supported by AnkiConnect; trying legacy compact mode.'
          );
        }
      } else {
        // no-op; handled below
      }

      if (!useRetrievedInfoMode) {
        if (useLegacyCompactCardsInfo) {
          try {
            cardInfos = await this.cardsInfo(chunk, requestedMetricFields, ankiConnectUrl, {
              noteFields: this.wordFields,
              compact: true
            });

            if (!this._hasUsableWarmCacheCards(cardInfos)) {
              useLegacyCompactCardsInfo = false;
              console.warn(
                'cardsInfo compact payload unusable for warm cache; falling back to full cardsInfo payload.'
              );
            }
          } catch (error) {
            if (!this._isUnsupportedCardsInfoOptionsError(error)) {
              throw error;
            }

            useLegacyCompactCardsInfo = false;
            console.warn(
              'cardsInfo noteFields/compact not supported by AnkiConnect; falling back to full cardsInfo payload.'
            );
          }
        }

        if (!useLegacyCompactCardsInfo) {
          cardInfos = await this.cardsInfo(chunk, requestedMetricFields, ankiConnectUrl);
        }
      }

      allCardInfos.push(...cardInfos);

      const completedChunks = Math.floor(i / CHUNK_SIZE) + 1;
      const completedSteps = 1 + completedChunks;
      reportProgress({
        phase: 'fetch-card-info',
        percentage: Math.round((completedSteps / totalSteps) * 100),
        completed: completedSteps,
        total: totalSteps,
        detail: `Fetching card info chunk ${completedChunks}/${totalChunks}`
      });
    }

    console.log(`getAllCardsFromDecks: Completed, got ${allCardInfos.length} cards`);
    return allCardInfos;
  }

  private async _findCardsDetailedByQuery(
    query: string,
    metricFields: CardMetricField[] | undefined,
    ankiConnectUrl?: string
  ): Promise<CardInfo[] | null> {
    try {
      const params: {
        query: string;
        fields?: CardMetricField[];
        noteFields?: string[];
      } = {
        query
      };

      if (metricFields && metricFields.length > 0) {
        params.fields = metricFields;
      }

      if (this.wordFields.length > 0) {
        params.noteFields = this.wordFields;
      }

      const response = await this._executeAction('findCards', params, ankiConnectUrl);
      if (!Array.isArray(response.result)) {
        return null;
      }

      if (response.result.length === 0) {
        return [];
      }

      // Legacy findCards returns number[]; detailed mode returns object[].
      if (typeof response.result[0] !== 'object' || response.result[0] === null) {
        return null;
      }

      const cards: CardInfo[] = [];
      for (const entry of response.result) {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const values = entry as Record<string, unknown>;
        const cardId = Number(values.cardId);
        if (!Number.isFinite(cardId)) {
          continue;
        }

        const card: CardInfo = {
          cardId,
          fields: this._extractNoteFieldsFromFindCardsEntry(values),
          'prop:r': typeof values['prop:r'] === 'number' ? (values['prop:r'] as number) : null,
          'prop:s': typeof values['prop:s'] === 'number' ? (values['prop:s'] as number) : null,
          'prop:d': typeof values['prop:d'] === 'number' ? (values['prop:d'] as number) : null,
          queue: typeof values.queue === 'number' ? (values.queue as number) : undefined,
          type: typeof values.type === 'number' ? (values.type as number) : undefined,
          reps: typeof values.reps === 'number' ? (values.reps as number) : undefined
        };

        cards.push(card);
      }

      if (cards.length === 0) {
        return [];
      }

      // If noteFields were requested but not returned in usable form, fall back.
      if (this.wordFields.length > 0 && !this._hasUsableWarmCacheCards(cards)) {
        console.warn(
          'findCards(query, fields, noteFields) returned unusable noteFields for warm cache; falling back to cardsInfo.'
        );
        return null;
      }

      return cards;
    } catch (error) {
      if (this._isUnsupportedFindCardsDetailsError(error)) {
        console.warn(
          'findCards(query, fields, noteFields) not supported by AnkiConnect; falling back to cardsInfo.'
        );
        return null;
      }

      // If query-based detailed mode fails for size/serialization reasons, fallback to chunked cardsInfo.
      console.warn(
        'findCards(query, fields, noteFields) failed; falling back to chunked cardsInfo.',
        error
      );
      return null;
    }
  }

  private _extractNoteFieldsFromFindCardsEntry(
    values: Record<string, unknown>
  ): CardInfo['fields'] {
    const result: CardInfo['fields'] = {};

    const nestedFields = values.fields;
    if (nestedFields && typeof nestedFields === 'object') {
      for (const [name, raw] of Object.entries(nestedFields as Record<string, unknown>)) {
        if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
          const value = (raw as Record<string, unknown>).value;
          result[name] = { value: typeof value === 'string' ? value : '' };
        } else if (typeof raw === 'string') {
          result[name] = { value: raw };
        }
      }
    }

    for (const fieldName of this.wordFields) {
      const directValue = values[fieldName];
      if (typeof directValue === 'string') {
        result[fieldName] = { value: directValue };
      } else if (
        directValue &&
        typeof directValue === 'object' &&
        'value' in (directValue as Record<string, unknown>)
      ) {
        const rawValue = (directValue as Record<string, unknown>).value;
        result[fieldName] = { value: typeof rawValue === 'string' ? rawValue : '' };
      }
    }

    return result;
  }

  private _isUnsupportedFindCardsDetailsError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : `${error}`;
    return /noteFields|fields|unexpected keyword|unknown parameter|unsupported|Unexpected findCards\(fields\) response payload/i.test(
      message
    );
  }

  private _isUnsupportedCardsInfoOptionsError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : `${error}`;
    return /noteFields|compact|retrieved_info_mode|unexpected keyword|unknown parameter|unsupported/i.test(
      message
    );
  }

  private _isUnsupportedRetrievedInfoModeError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : `${error}`;
    return /retrieved_info_mode|unexpected keyword|unknown parameter|unsupported/i.test(message);
  }

  private _hasUsableWarmCacheCards(cardInfos: CardInfo[]): boolean {
    if (!Array.isArray(cardInfos) || cardInfos.length === 0) {
      return false;
    }

    return cardInfos.some((cardInfo) => {
      if (!Number.isFinite(cardInfo?.cardId)) {
        return false;
      }

      if (!cardInfo.fields || typeof cardInfo.fields !== 'object') {
        return false;
      }

      return this.wordFields.some((field) => {
        const value = cardInfo.fields[field]?.value;
        return typeof value === 'string' && value.trim().length > 0;
      });
    });
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
