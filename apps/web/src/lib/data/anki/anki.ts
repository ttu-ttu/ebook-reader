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
type FindCardsDetailField = CardMetricField | 'due' | 'queue' | 'type' | 'interval' | 'reps';
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

export interface CardScheduleInfo {
  cardId: number;
  due?: number;
  queue?: number;
  type?: number;
  interval?: number;
  reps?: number;
}

export interface GetAllCardsProgress {
  phase: 'query-detailed';
  percentage: number;
  completed: number;
  total: number;
  detail: string;
}

export interface RepositionNewCardsParams {
  orderedCardIds: number[];
  startPosition: number;
  step: number;
  shift: boolean;
}

export interface RepositionNewCardsResult {
  requested: number;
  deduped: number;
  eligibleNew: number;
  repositioned: number;
  skippedNotFound: number[];
  skippedNotNew: number[];
  appliedStartPosition: number;
  appliedStep: number;
  appliedShift: boolean;
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

  async repositionNewCards(
    params: RepositionNewCardsParams,
    ankiConnectUrl?: string
  ): Promise<RepositionNewCardsResult> {
    if (!Array.isArray(params.orderedCardIds) || params.orderedCardIds.length === 0) {
      throw new Error('repositionNewCards requires orderedCardIds.');
    }
    if (!Number.isFinite(params.startPosition) || params.startPosition < 1) {
      throw new Error('repositionNewCards requires startPosition >= 1.');
    }
    if (!Number.isFinite(params.step) || params.step < 1) {
      throw new Error('repositionNewCards requires step >= 1.');
    }

    const normalizedCardIds = params.orderedCardIds
      .map((cardId) => Number(cardId))
      .filter((cardId) => Number.isFinite(cardId));

    if (normalizedCardIds.length === 0) {
      throw new Error('repositionNewCards requires at least one numeric card ID.');
    }

    const response = await this._executeAction(
      'repositionNewCards',
      {
        orderedCardIds: normalizedCardIds,
        startPosition: Math.trunc(params.startPosition),
        step: Math.trunc(params.step),
        shift: !!params.shift
      },
      ankiConnectUrl
    );

    const result = response?.result;
    if (!result || typeof result !== 'object') {
      throw new Error('Unexpected repositionNewCards response payload.');
    }

    const values = result as Record<string, unknown>;
    return {
      requested: Number(values.requested) || 0,
      deduped: Number(values.deduped) || 0,
      eligibleNew: Number(values.eligibleNew) || 0,
      repositioned: Number(values.repositioned) || 0,
      skippedNotFound: Array.isArray(values.skippedNotFound)
        ? values.skippedNotFound
            .map((cardId) => Number(cardId))
            .filter((cardId) => Number.isFinite(cardId))
        : [],
      skippedNotNew: Array.isArray(values.skippedNotNew)
        ? values.skippedNotNew
            .map((cardId) => Number(cardId))
            .filter((cardId) => Number.isFinite(cardId))
        : [],
      appliedStartPosition: Number(values.appliedStartPosition) || Math.trunc(params.startPosition),
      appliedStep: Number(values.appliedStep) || Math.trunc(params.step),
      appliedShift: Boolean(values.appliedShift)
    };
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

  async cardScheduleMap(
    cardIds: number[],
    ankiConnectUrl?: string
  ): Promise<Map<number, CardScheduleInfo>> {
    const result = new Map<number, CardScheduleInfo>();
    const uniqueCardIds = Array.from(new Set(cardIds.filter((id) => Number.isFinite(id))));
    if (uniqueCardIds.length === 0) {
      return result;
    }

    const QUERY_CHUNK_SIZE = 250;
    const fields: FindCardsDetailField[] = ['due', 'queue', 'type', 'interval', 'reps'];

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
          due: typeof values.due === 'number' ? (values.due as number) : undefined,
          queue: typeof values.queue === 'number' ? (values.queue as number) : undefined,
          type: typeof values.type === 'number' ? (values.type as number) : undefined,
          interval: typeof values.interval === 'number' ? (values.interval as number) : undefined,
          reps: typeof values.reps === 'number' ? (values.reps as number) : undefined
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

    // Strict chunked path: get card IDs once, then fetch detailed rows by cid chunks.
    reportProgress({
      phase: 'query-detailed',
      percentage: 0,
      completed: 0,
      total: 1,
      detail: 'Fetching card IDs via query'
    });
    const queryDetailFields: FindCardsDetailField[] | undefined = requestedMetricFields
      ? Array.from(
          new Set<FindCardsDetailField>([...requestedMetricFields, 'due', 'queue', 'type'])
        )
      : ['due', 'queue', 'type'];

    const idsResponse = await this._executeAction(
      'findCards',
      { query: deckQuery },
      ankiConnectUrl
    );
    if (!Array.isArray(idsResponse.result)) {
      throw new Error('Unexpected findCards response payload while fetching card IDs.');
    }

    const cardIds = idsResponse.result
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isFinite(value));
    if (cardIds.length === 0) {
      reportProgress({
        phase: 'query-detailed',
        percentage: 100,
        completed: 1,
        total: 1,
        detail: 'No cards found'
      });
      return [];
    }

    const CHUNK_SIZE = 2500;
    const totalChunks = Math.ceil(cardIds.length / CHUNK_SIZE);
    reportProgress({
      phase: 'query-detailed',
      percentage: 5,
      completed: 0,
      total: totalChunks,
      detail: `Found ${cardIds.length} cards, fetching ${totalChunks} chunks`
    });

    const allCards: CardInfo[] = [];
    for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
      const chunk = cardIds.slice(i, i + CHUNK_SIZE);
      const chunkCards = await this._findCardsDetailedByCards(
        chunk,
        queryDetailFields,
        ankiConnectUrl
      );
      allCards.push(...chunkCards);

      const completed = Math.floor(i / CHUNK_SIZE) + 1;
      reportProgress({
        phase: 'query-detailed',
        percentage: Math.round((completed / totalChunks) * 100),
        completed,
        total: totalChunks,
        detail: `Fetched chunk ${completed}/${totalChunks}`
      });
    }

    console.log(
      `getAllCardsFromDecks: Chunked query findCards path returned ${allCards.length} cards`
    );
    return allCards;
  }

  private async _findCardsDetailedByCards(
    cards: number[],
    metricFields: FindCardsDetailField[] | undefined,
    ankiConnectUrl?: string
  ): Promise<CardInfo[]> {
    const params: {
      cards: number[];
      fields?: FindCardsDetailField[];
      noteFields?: string[];
    } = {
      cards
    };

    if (metricFields && metricFields.length > 0) {
      params.fields = metricFields;
    }

    if (this.wordFields.length > 0) {
      params.noteFields = this.wordFields;
    }

    const response = await this._executeAction('cardsDetails', params, ankiConnectUrl);
    if (!Array.isArray(response.result)) {
      throw new Error('Unexpected cardsDetails response payload.');
    }

    if (response.result.length === 0) {
      return [];
    }

    if (typeof response.result[0] !== 'object' || response.result[0] === null) {
      throw new Error(
        'cardsDetails(cards, fields, noteFields) must return detailed card entries for warm cache.'
      );
    }

    const detailedCards: CardInfo[] = [];
    for (const entry of response.result) {
      if (!entry || typeof entry !== 'object') {
        throw new Error('Invalid detailed cardsDetails payload for warm cache.');
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
        due: typeof values.due === 'number' ? (values.due as number) : undefined,
        interval: typeof values.interval === 'number' ? (values.interval as number) : undefined,
        queue: typeof values.queue === 'number' ? (values.queue as number) : undefined,
        type: typeof values.type === 'number' ? (values.type as number) : undefined,
        reps: typeof values.reps === 'number' ? (values.reps as number) : undefined
      };

      detailedCards.push(card);
    }

    if (this.wordFields.length > 0 && !this._hasUsableWarmCacheCards(detailedCards)) {
      throw new Error('cardsDetails payload is missing usable note fields for warm cache.');
    }

    return detailedCards;
  }

  private _extractNoteFieldsFromFindCardsEntry(
    values: Record<string, unknown>
  ): CardInfo['fields'] {
    const result: CardInfo['fields'] = {};

    const mergeFieldContainer = (container: unknown): void => {
      if (!container || typeof container !== 'object') {
        return;
      }

      for (const [name, raw] of Object.entries(container as Record<string, unknown>)) {
        if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
          const value = (raw as Record<string, unknown>).value;
          result[name] = { value: typeof value === 'string' ? value : '' };
        } else if (typeof raw === 'string') {
          result[name] = { value: raw };
        }
      }
    };

    mergeFieldContainer(values.noteFields);

    const nestedFields = values.fields;
    mergeFieldContainer(nestedFields);

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
