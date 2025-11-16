/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import { Yomitan } from '$lib/data/yomitan';
import { Anki } from '$lib/data/anki';
import { TokenColor, TokenStyle } from '$lib/data/anki/token-color';
import type { AnkiCacheService } from '$lib/data/database/anki-cache-db';

/** Regex to check if text contains letters */
const HAS_LETTER_REGEX = /\p{L}/u;

export interface ColoringOptions {
  enabled: boolean;
  yomitanUrl: string;
  ankiConnectUrl: string;
  wordFields: string[];
  wordDeckNames: string[];
  matureThreshold: number;
  tokenStyle: TokenStyle;
}

/**
 * Service for coloring book content based on Anki card intervals
 * Based on asbplayer token coloring implementation
 */
export class BookContentColoring {
  private yomitan: Yomitan;
  private anki: Anki;
  private tokenizeCache = new Map<string, string[]>();
  private lemmatizeCache = new Map<string, string[]>();
  private tokenColorCache = new Map<string, TokenColor>();
  private tokenCardIdsCache = new Map<string, number[]>();
  private cacheService?: AnkiCacheService;
  private options: ColoringOptions;

  constructor(options: ColoringOptions, cacheService?: AnkiCacheService) {
    this.options = options;
    this.yomitan = new Yomitan(options.yomitanUrl, 12, cacheService);
    this.anki = new Anki(options.ankiConnectUrl, options.wordFields, options.wordDeckNames);
    this.cacheService = cacheService;
  }

  /**
   * Colorize a single DOM element in-place (incremental coloring)
   * This method is optimized for viewport-based coloring
   * @param element - DOM element to colorize
   * @returns Promise that resolves when coloring is complete
   */
  async colorizeElement(element: Element): Promise<void> {
    if (!this.options.enabled) return;

    // Skip if already colored
    if (element.hasAttribute('data-anki-colored')) return;

    try {
      // Find all text nodes in this element
      const textNodes = this._getTextNodes(element);

      // Process each text node
      for (const textNode of textNodes) {
        if (!textNode.textContent || !textNode.parentElement) continue;

        const coloredHtml = await this._colorizeText(textNode.textContent);
        const span = document.createElement('span');
        span.innerHTML = coloredHtml;

        // Replace text node with colored span
        textNode.parentElement.replaceChild(span, textNode);
      }

      // Mark as colored to avoid reprocessing
      element.setAttribute('data-anki-colored', 'true');
    } catch (error) {
      console.error('Error colorizing element:', error);
      // Don't throw - just skip this element
    }
  }

  /**
   * Colorize multiple DOM elements together with shared token batching
   * This is more efficient than calling colorizeElement multiple times
   * @param elements - Array of DOM elements to colorize
   * @returns Promise that resolves when all elements are colored
   */
  async colorizeElementsBatch(elements: Element[]): Promise<void> {
    if (!this.options.enabled) return;
    if (elements.length === 0) return;

    try {
      // Step 1: Collect all text nodes from all elements
      const elementTextNodes = new Map<Element, Text[]>();
      const allTexts = new Set<string>();

      for (const element of elements) {
        if (element.hasAttribute('data-anki-colored')) continue;

        const textNodes = this._getTextNodes(element);
        if (textNodes.length > 0) {
          elementTextNodes.set(element, textNodes);
          textNodes.forEach((node) => {
            if (node.textContent) allTexts.add(node.textContent);
          });
        }
      }

      if (allTexts.size === 0) return;

      // Step 2: Collect all unique tokens from all texts
      const allTokens = new Set<string>();
      const textToTokensMap = new Map<string, string[]>();

      for (const text of allTexts) {
        const tokens = await this._getOrFetchTokens(text);
        textToTokensMap.set(text, tokens);

        // Collect unique tokens that need color checking
        for (const token of tokens) {
          const trimmed = token.trim();
          if (HAS_LETTER_REGEX.test(trimmed)) {
            allTokens.add(trimmed);
          }
        }
      }

      // Step 3: Batch fetch colors for ALL tokens from ALL elements at once
      const globalColorMap = new Map<string, TokenColor>();
      const uncachedTokens: string[] = [];

      for (const token of allTokens) {
        // Check caches
        let cached = this.tokenColorCache.get(token);
        if (cached === undefined && this.cacheService) {
          cached = await this.cacheService.getTokenColor(token);
          if (cached !== undefined) {
            this.tokenColorCache.set(token, cached);
          }
        }

        if (cached !== undefined) {
          globalColorMap.set(token, cached);
        } else {
          uncachedTokens.push(token);
        }
      }

      // Batch fetch all uncached tokens in one go
      if (uncachedTokens.length > 0) {
        await this._batchFetchTokenColors(uncachedTokens, globalColorMap);
      }

      // Step 4: Apply colors to all elements
      for (const [element, textNodes] of elementTextNodes.entries()) {
        for (const textNode of textNodes) {
          if (!textNode.textContent || !textNode.parentElement) continue;

          const tokens = textToTokensMap.get(textNode.textContent) || [];
          let coloredHtml = '';

          for (const rawToken of tokens) {
            const trimmed = rawToken.trim();
            const color = HAS_LETTER_REGEX.test(trimmed)
              ? globalColorMap.get(trimmed) || TokenColor.UNCOLLECTED
              : TokenColor.MATURE;

            coloredHtml += this._applyTokenStyle(rawToken, color);
          }

          const span = document.createElement('span');
          span.innerHTML = coloredHtml;
          textNode.parentElement.replaceChild(span, textNode);
        }

        element.setAttribute('data-anki-colored', 'true');
      }
    } catch (error) {
      console.error('Error colorizing elements batch:', error);
    }
  }

  /**
   * Colorize a text string by tokenizing and applying colors
   * Uses batched API calls for optimal performance
   * @param text - Text to colorize
   * @returns HTML string with colored tokens
   */
  private async _colorizeText(text: string): Promise<string> {
    try {
      // Step 1: Tokenize text
      const tokens = await this._getOrFetchTokens(text);

      // Step 2: Collect unique tokens and check caches
      const tokenColorMap = new Map<string, TokenColor>();
      const uncachedTokens: string[] = [];

      for (const rawToken of tokens) {
        const trimmedToken = rawToken.trim();

        // Skip non-letter tokens
        if (!HAS_LETTER_REGEX.test(trimmedToken)) {
          tokenColorMap.set(trimmedToken, TokenColor.MATURE);
          continue;
        }

        // Skip if already processed
        if (tokenColorMap.has(trimmedToken)) continue;

        // Check memory cache
        let cached = this.tokenColorCache.get(trimmedToken);
        if (cached !== undefined) {
          tokenColorMap.set(trimmedToken, cached);
          continue;
        }

        // Check persistent cache
        if (this.cacheService) {
          cached = await this.cacheService.getTokenColor(trimmedToken);
          if (cached !== undefined) {
            this.tokenColorCache.set(trimmedToken, cached);
            tokenColorMap.set(trimmedToken, cached);
            continue;
          }
        }

        // Mark as uncached
        uncachedTokens.push(trimmedToken);
      }

      // Step 3: Batch fetch all uncached tokens from Anki
      if (uncachedTokens.length > 0) {
        await this._batchFetchTokenColors(uncachedTokens, tokenColorMap);
      }

      // Step 4: Build colored HTML
      let coloredHtml = '';
      for (const rawToken of tokens) {
        const trimmedToken = rawToken.trim();
        const color = tokenColorMap.get(trimmedToken) || TokenColor.UNCOLLECTED;
        coloredHtml += this._applyTokenStyle(rawToken, color);
      }

      return coloredHtml;
    } catch (error) {
      console.error('Error colorizing text:', error);
      return this._applyTokenStyle(text, TokenColor.ERROR);
    }
  }

  /**
   * Get or fetch tokens for text (with caching)
   * @param text - Text to tokenize
   * @returns Array of tokens
   */
  private async _getOrFetchTokens(text: string): Promise<string[]> {
    // Check memory cache
    let tokens = this.tokenizeCache.get(text);
    if (tokens) return tokens;

    // Check persistent cache
    if (this.cacheService) {
      tokens = await this.cacheService.getTokens(text);
      if (tokens) {
        this.tokenizeCache.set(text, tokens);
        return tokens;
      }
    }

    // Fetch from Yomitan API
    tokens = await this.yomitan.tokenize(text);
    this.tokenizeCache.set(text, tokens);

    // Persist to cache
    if (this.cacheService) {
      await this.cacheService.setTokens(text, tokens);
    }

    return tokens;
  }

  /**
   * Batch fetch token colors from Anki for multiple uncached tokens
   * Processes tokens in small chunks to avoid overwhelming Anki Connect
   * @param tokens - Array of uncached tokens
   * @param colorMap - Map to populate with token -> color mappings
   */
  private async _batchFetchTokenColors(
    tokens: string[],
    colorMap: Map<string, TokenColor>
  ): Promise<void> {
    const CHUNK_SIZE = 10; // Process 10 tokens at a time
    const tokenToCardIds = new Map<string, number[]>();
    const allCardIds: number[] = [];
    const uncachedTokens: string[] = [];

    // Step 1: Check card ID caches (memory + IndexedDB)
    for (const token of tokens) {
      // Check in-memory cache
      let cardIds = this.tokenCardIdsCache.get(token);

      // Check IndexedDB cache if not in memory
      if (cardIds === undefined && this.cacheService) {
        cardIds = await this.cacheService.getTokenCardIds(token);
        if (cardIds !== undefined) {
          this.tokenCardIdsCache.set(token, cardIds);
        }
      }

      if (cardIds !== undefined) {
        // Use cached card IDs (even if empty array)
        tokenToCardIds.set(token, cardIds);
        if (cardIds.length > 0) {
          allCardIds.push(...cardIds);
        }
      } else {
        // Need to query Anki
        uncachedTokens.push(token);
      }
    }

    // Step 2: Query Anki only for uncached tokens
    if (uncachedTokens.length > 0) {
      // Create chunks
      const chunks: string[][] = [];
      for (let i = 0; i < uncachedTokens.length; i += CHUNK_SIZE) {
        chunks.push(uncachedTokens.slice(i, i + CHUNK_SIZE));
      }

      // Query all chunks in parallel
      const chunkResults = await Promise.all(
        chunks.map((chunk) => this.anki.findCardsWithWordsBatch(chunk, this.anki.getWordFields()))
      );

      // Collect card IDs from all chunks
      for (const cardMap of chunkResults) {
        for (const [token, cardIds] of cardMap.entries()) {
          tokenToCardIds.set(token, cardIds);

          // Cache the card IDs
          this.tokenCardIdsCache.set(token, cardIds);
          if (this.cacheService) {
            await this.cacheService.setTokenCardIds(token, cardIds);
          }

          if (cardIds.length > 0) {
            allCardIds.push(...cardIds);
          }
        }
      }
    }

    // Batch fetch card info for all cards (still batch this part)
    const cardInfoMap = new Map<number, number>(); // cardId -> interval
    if (allCardIds.length > 0) {
      const cardInfos = await this.anki.cardsInfo(allCardIds);
      cardInfos.forEach((info) => {
        cardInfoMap.set(info.cardId, info.interval);
      });
    }

    // Process results for each token
    const uncollectedTokens: string[] = [];

    for (const token of tokens) {
      const cardIds = tokenToCardIds.get(token);

      if (!cardIds || cardIds.length === 0) {
        // No cards found - will need lemmatization
        uncollectedTokens.push(token);
        continue;
      }

      // Get intervals for this token's cards
      const intervals = cardIds.map((id) => cardInfoMap.get(id) || 0);
      const color = this._getColorFromIntervals(intervals);

      // Cache and store
      this.tokenColorCache.set(token, color);
      colorMap.set(token, color);

      if (this.cacheService) {
        await this.cacheService.setTokenColor(token, color, intervals[0]);
      }
    }

    // Handle uncollected tokens with lemmatization (also chunked)
    if (uncollectedTokens.length > 0) {
      await this._handleUncollectedTokensBatch(uncollectedTokens, colorMap);
    }
  }

  /**
   * Handle uncollected tokens by lemmatizing and checking lemmas
   * @param tokens - Array of uncollected tokens
   * @param colorMap - Map to populate with token -> color mappings
   */
  private async _handleUncollectedTokensBatch(
    tokens: string[],
    colorMap: Map<string, TokenColor>
  ): Promise<void> {
    // Parallelize lemmatization (Phase 2 optimization)
    const lemmaPromises = tokens.map(async (token) => {
      let lemmas = this.lemmatizeCache.get(token);

      if (!lemmas && this.cacheService) {
        lemmas = await this.cacheService.getLemmas(token);
        if (lemmas) {
          this.lemmatizeCache.set(token, lemmas);
        }
      }

      if (!lemmas) {
        lemmas = await this.yomitan.lemmatize(token);
        this.lemmatizeCache.set(token, lemmas);

        if (this.cacheService) {
          await this.cacheService.setLemmas(token, lemmas);
        }
      }

      return { token, lemmas };
    });

    const lemmaResults = await Promise.all(lemmaPromises);

    // Collect all unique lemmas for batch query
    const allLemmas = new Set<string>();
    const tokenToLemmas = new Map<string, string[]>();

    for (const { token, lemmas } of lemmaResults) {
      tokenToLemmas.set(token, lemmas);
      lemmas.forEach((lemma) => allLemmas.add(lemma));
    }

    // Batch query Anki for all lemmas (in chunks of 10, parallelized)
    const CHUNK_SIZE = 10;
    const lemmaCardMap = new Map<string, number[]>();
    const lemmasArray = Array.from(allLemmas);
    const uncachedLemmas: string[] = [];

    // Check card ID cache for lemmas
    for (const lemma of lemmasArray) {
      // Check in-memory cache
      let cardIds = this.tokenCardIdsCache.get(lemma);

      // Check IndexedDB cache if not in memory
      if (cardIds === undefined && this.cacheService) {
        cardIds = await this.cacheService.getTokenCardIds(lemma);
        if (cardIds !== undefined) {
          this.tokenCardIdsCache.set(lemma, cardIds);
        }
      }

      if (cardIds !== undefined) {
        // Use cached card IDs
        lemmaCardMap.set(lemma, cardIds);
      } else {
        // Need to query Anki
        uncachedLemmas.push(lemma);
      }
    }

    // Query Anki only for uncached lemmas
    if (uncachedLemmas.length > 0) {
      // Create chunks
      const lemmaChunks: string[][] = [];
      for (let i = 0; i < uncachedLemmas.length; i += CHUNK_SIZE) {
        lemmaChunks.push(uncachedLemmas.slice(i, i + CHUNK_SIZE));
      }

      // Query all chunks in parallel
      const lemmaChunkResults = await Promise.all(
        lemmaChunks.map((chunk) =>
          this.anki.findCardsWithWordsBatch(chunk, this.anki.getWordFields())
        )
      );

      // Merge results and cache
      for (const chunkCardMap of lemmaChunkResults) {
        for (const [lemma, cardIds] of chunkCardMap.entries()) {
          lemmaCardMap.set(lemma, cardIds);

          // Cache the card IDs
          this.tokenCardIdsCache.set(lemma, cardIds);
          if (this.cacheService) {
            await this.cacheService.setTokenCardIds(lemma, cardIds);
          }
        }
      }
    }

    // Collect all lemma card IDs
    const allLemmaCardIds: number[] = [];
    for (const cardIds of lemmaCardMap.values()) {
      allLemmaCardIds.push(...cardIds);
    }

    // Batch fetch card info for lemmas
    const lemmaCardInfoMap = new Map<number, number>();
    if (allLemmaCardIds.length > 0) {
      const cardInfos = await this.anki.cardsInfo(allLemmaCardIds);
      cardInfos.forEach((info) => {
        lemmaCardInfoMap.set(info.cardId, info.interval);
      });
    }

    // Process each uncollected token
    for (const token of tokens) {
      const lemmas = tokenToLemmas.get(token) || [];
      let finalColor = TokenColor.UNCOLLECTED;

      // Check each lemma
      for (const lemma of lemmas) {
        const cardIds = lemmaCardMap.get(lemma) || [];

        if (cardIds.length > 0) {
          const intervals = cardIds.map((id) => lemmaCardInfoMap.get(id) || 0);
          const color = this._getColorFromIntervals(intervals);

          if (color !== TokenColor.UNCOLLECTED) {
            finalColor = color;
            break;
          }
        }
      }

      // Cache and store
      this.tokenColorCache.set(token, finalColor);
      colorMap.set(token, finalColor);

      if (this.cacheService) {
        await this.cacheService.setTokenColor(token, finalColor);
      }
    }
  }

  /**
   * Get color for a token based on Anki card intervals
   * @param token - Token to look up
   * @returns Token color
   */
  private async _getTokenColor(token: string): Promise<TokenColor> {
    // Check in-memory cache first
    let cached = this.tokenColorCache.get(token);
    if (cached !== undefined) return cached;

    // Check persistent cache
    if (this.cacheService) {
      cached = await this.cacheService.getTokenColor(token);
      if (cached !== undefined) {
        this.tokenColorCache.set(token, cached);
        return cached;
      }
    }

    try {
      // Search in word fields first (exact match)
      const cardIds = await this.anki.findCardsWithWord(token, this.anki.getWordFields());

      if (cardIds.length) {
        const intervals = await this.anki.currentIntervals(cardIds);
        const color = this._getColorFromIntervals(intervals);
        this.tokenColorCache.set(token, color);

        // Persist to IndexedDB cache
        if (this.cacheService) {
          await this.cacheService.setTokenColor(token, color, intervals[0]);
        }

        return color;
      }

      if (!cardIds.length) {
        this.tokenColorCache.set(token, TokenColor.UNCOLLECTED);

        // Persist to IndexedDB cache
        if (this.cacheService) {
          await this.cacheService.setTokenColor(token, TokenColor.UNCOLLECTED);
        }

        return TokenColor.UNCOLLECTED;
      }

      const cardInfos = await this.anki.cardsInfo(cardIds);
      const intervals = cardInfos.map((info) => info.interval);
      const color = this._getColorFromIntervals(intervals);
      this.tokenColorCache.set(token, color);

      // Persist to IndexedDB cache
      if (this.cacheService) {
        await this.cacheService.setTokenColor(token, color, intervals[0]);
      }

      return color;
    } catch (error) {
      console.error(`Error getting color for token "${token}":`, error);
      return TokenColor.ERROR;
    }
  }

  /**
   * Determine color based on card intervals
   * @param intervals - Array of card intervals in days
   * @returns Token color
   */
  private _getColorFromIntervals(intervals: number[]): TokenColor {
    if (!intervals.length) return TokenColor.ERROR;

    // All cards are mature
    if (intervals.some((i) => i >= this.options.matureThreshold)) {
      return TokenColor.MATURE;
    }

    // All cards are new/unknown
    if (intervals.every((i) => i === 0)) {
      return TokenColor.UNKNOWN;
    }

    // Mixed or learning cards
    return TokenColor.YOUNG;
  }

  /**
   * Apply styling to a token based on its color
   * @param token - Token text
   * @param color - Token color
   * @returns HTML string with applied style
   */
  private _applyTokenStyle(token: string, color: TokenColor): string {
    let style = this.options.tokenStyle;

    // Use underline for errors if text style selected
    if (color === TokenColor.ERROR && style === TokenStyle.TEXT) {
      style = TokenStyle.UNDERLINE;
    }

    // Don't style uncollected tokens
    if (color === TokenColor.UNCOLLECTED) {
      return token;
    }

    switch (style) {
      case TokenStyle.TEXT:
        return `<span style="color: ${color};">${token}</span>`;
      case TokenStyle.UNDERLINE: {
        const decoration = color === TokenColor.ERROR ? 'double' : 'solid';
        return `<span style="text-decoration: underline ${color} ${decoration};">${token}</span>`;
      }
      default:
        return token;
    }
  }

  /**
   * Get all text nodes from an element, excluding ruby/rt tags
   * @param element - Root element to search
   * @returns Array of text nodes
   */
  private _getTextNodes(element: Element): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip ruby text (furigana) and ruby parentheses
        if (parent.tagName === 'RT' || parent.tagName === 'RP') {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip empty/whitespace-only nodes
        if (!node.textContent?.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    return textNodes;
  }

  /**
   * Clear all caches (both in-memory and persistent)
   */
  async clearCache(): Promise<void> {
    this.tokenizeCache.clear();
    this.lemmatizeCache.clear();
    this.tokenColorCache.clear();
    this.tokenCardIdsCache.clear();

    // Also clear persistent cache
    if (this.cacheService) {
      await this.cacheService.clearAllCaches();
    }
  }

  /**
   * Preemptively warm the cache with all cards from configured Anki decks
   * Runs in the background to populate the cache for faster future lookups
   * @returns Promise with cache warming statistics
   */
  async warmCache(): Promise<{
    totalCards: number;
    cachedWords: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let cachedWords = 0;

    try {
      console.log('Starting Anki cache warming...');

      // Get all cards from configured decks
      const allCards = await this.anki.getAllCardsFromDecks();

      if (allCards.length === 0) {
        console.warn('No cards found for cache warming');
        return { totalCards: 0, cachedWords: 0, duration: Date.now() - startTime };
      }

      console.log(`Found ${allCards.length} cards. Populating cache...`);

      // Extract unique words from configured word fields
      const wordToCardIds = new Map<string, number[]>();
      const wordFields = this.anki.getWordFields();

      for (const card of allCards) {
        for (const field of wordFields) {
          const fieldValue = card.fields[field]?.value;
          if (fieldValue) {
            const word = fieldValue.trim();
            if (word) {
              const cardIds = wordToCardIds.get(word) || [];
              cardIds.push(card.cardId);
              wordToCardIds.set(word, cardIds);
            }
          }
        }
      }

      console.log(`Extracted ${wordToCardIds.size} unique words from cards`);

      // Build interval map
      const cardIntervalMap = new Map<number, number>();
      for (const card of allCards) {
        cardIntervalMap.set(card.cardId, card.interval);
      }

      // Cache all words with their colors and card IDs
      for (const [word, cardIds] of wordToCardIds.entries()) {
        const intervals = cardIds.map((id) => cardIntervalMap.get(id) || 0);
        const color = this._getColorFromIntervals(intervals);

        // Store in memory caches
        this.tokenColorCache.set(word, color);
        this.tokenCardIdsCache.set(word, cardIds);

        // Store in persistent caches
        if (this.cacheService) {
          await this.cacheService.setTokenColor(word, color, intervals[0]);
          await this.cacheService.setTokenCardIds(word, cardIds);
        }

        cachedWords++;
      }

      const duration = Date.now() - startTime;
      console.log(`Cache warming complete: ${cachedWords} words cached in ${duration}ms`);

      return { totalCards: allCards.length, cachedWords, duration };
    } catch (error) {
      console.error('Error during cache warming:', error);
      const duration = Date.now() - startTime;
      return { totalCards: 0, cachedWords, duration };
    }
  }
}
