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
  // Single cache: word -> {status, cardIds}
  private wordDataCache = new Map<
    string,
    { status: 'mature' | 'young' | 'new' | 'unknown'; cardIds: number[] }
  >();
  private cacheService?: AnkiCacheService;
  private options: ColoringOptions;

  constructor(options: ColoringOptions, cacheService?: AnkiCacheService) {
    this.options = options;
    this.yomitan = new Yomitan(options.yomitanUrl, 12, cacheService);
    this.anki = new Anki(options.ankiConnectUrl, options.wordFields, options.wordDeckNames);
    this.cacheService = cacheService;

    // Mark as ready immediately - cache will load in background
    this.isReady = true;

    // Initialize ready promise as already resolved
    this.readyPromise = Promise.resolve();
  }

  private markReady(): void {
    // No-op, kept for compatibility
  }

  /**
   * Build stability cache for all cards in configured decks
   * Should be called once on initialization for optimal performance
   * @returns Promise with cache statistics
   */
  async buildStabilityCache(): Promise<{
    matureCards: number;
    youngCards: number;
    newCards: number;
  }> {
    try {
      this.stabilityCache = await this.anki.buildStabilityCacheForDecks(
        this.options.matureThreshold
      );

      const matureCards = Array.from(this.stabilityCache.values()).filter(
        (c) => c === 'mature'
      ).length;
      const youngCards = Array.from(this.stabilityCache.values()).filter(
        (c) => c === 'young'
      ).length;
      const newCards = Array.from(this.stabilityCache.values()).filter((c) => c === 'new').length;

      return { matureCards, youngCards, newCards };
    } catch (error) {
      console.error('Error building stability cache:', error);
      return { matureCards: 0, youngCards: 0, newCards: 0 };
    }
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
        const textContent = textNode.textContent;
        if (!textContent || !textNode.parentElement) continue;

        const coloredHtml = await this._colorizeText(textContent);

        // Use a template element to parse HTML and create a document fragment
        // This avoids creating an extra wrapper span
        const template = document.createElement('template');
        template.innerHTML = coloredHtml;
        const fragment = template.content;

        // Replace text node with the fragment (which contains the colored spans)
        textNode.parentElement.replaceChild(fragment, textNode);
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

    console.log(
      `🎨 colorizeElementsBatch called with ${elements.length} elements, cache has ${this.wordDataCache.size} words`
    );

    try {
      // Step 1: Collect all text nodes and combine adjacent ones for proper tokenization
      const elementTextNodes = new Map<Element, Text[]>();
      const elementCombinedText = new Map<Element, string>();

      for (const element of elements) {
        if (element.hasAttribute('data-anki-colored')) continue;

        const textNodes = this._getTextNodes(element);
        if (textNodes.length > 0) {
          elementTextNodes.set(element, textNodes);
          // Combine all text from this element for tokenization
          // This ensures words split across ruby/span boundaries are tokenized together
          const combinedText = textNodes.map((node) => node.textContent || '').join('');
          elementCombinedText.set(element, combinedText);
        }
      }

      if (elementCombinedText.size === 0) return;

      // Step 2: Tokenize the combined text from each element
      const elementTokensMap = new Map<Element, string[]>();
      const allTokens = new Set<string>();

      for (const [element, combinedText] of elementCombinedText.entries()) {
        const tokens = await this._getOrFetchTokens(combinedText);
        elementTokensMap.set(element, tokens);

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
        // Check memory cache only (no persistent cache lookup)
        const cached = this.tokenColorCache.get(token);

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

      // Step 4: Apply colors to elements incrementally across animation frames
      // Map tokens to character positions, then color each text node individually
      const elementEntries = Array.from(elementTextNodes.entries());

      for (let i = 0; i < elementEntries.length; i++) {
        const [element, textNodes] = elementEntries[i];
        const tokens = elementTokensMap.get(element) || [];

        // Use requestAnimationFrame to spread DOM updates across frames
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            // Build a map of character position -> token color
            let currentPos = 0;
            const positionColorMap = new Map<number, { token: string; color: TokenColor }>();

            for (const rawToken of tokens) {
              const trimmed = rawToken.trim();
              const color = HAS_LETTER_REGEX.test(trimmed)
                ? globalColorMap.get(trimmed) || TokenColor.UNCOLLECTED
                : TokenColor.MATURE;

              // Map each character position in this token to its color
              for (let charIdx = 0; charIdx < rawToken.length; charIdx++) {
                positionColorMap.set(currentPos + charIdx, { token: rawToken, color });
              }
              currentPos += rawToken.length;
            }

            // Color each text node individually based on its position in the combined text
            let textNodeStartPos = 0;
            for (const textNode of textNodes) {
              if (!textNode.textContent || !textNode.parentElement) continue;

              const nodeText = textNode.textContent;
              const nodeEndPos = textNodeStartPos + nodeText.length;

              // Determine which tokens overlap with this text node
              const nodeTokens: Array<{ text: string; color: TokenColor }> = [];
              let currentToken = '';
              let currentColor: TokenColor | null = null;

              for (let pos = textNodeStartPos; pos < nodeEndPos; pos++) {
                const posInfo = positionColorMap.get(pos);
                if (!posInfo) continue;

                // If color changes, save the current token and start a new one
                if (currentColor !== null && currentColor !== posInfo.color) {
                  nodeTokens.push({ text: currentToken, color: currentColor });
                  currentToken = '';
                }

                currentToken += nodeText[pos - textNodeStartPos];
                currentColor = posInfo.color;
              }

              // Save the last token
              if (currentToken && currentColor !== null) {
                nodeTokens.push({ text: currentToken, color: currentColor });
              }

              // Build colored HTML for this text node
              let coloredHtml = '';
              for (const { text, color } of nodeTokens) {
                coloredHtml += this._applyTokenStyle(text, color);
              }

              // Replace this text node with colored version (preserves structure)
              if (coloredHtml && textNode.parentElement) {
                // Save reference to parent before replacing (needed for ruby check)
                const parentElement = textNode.parentElement;

                // Check if this text node is inside a ruby element BEFORE replacing
                let rubyElement: Element | null = parentElement;
                while (rubyElement && rubyElement !== element) {
                  if (rubyElement.tagName === 'RUBY') {
                    break;
                  }
                  rubyElement = rubyElement.parentElement;
                }

                // Replace the text node with colored HTML
                const template = document.createElement('template');
                template.innerHTML = coloredHtml;
                const fragment = template.content;
                parentElement.replaceChild(fragment, textNode);

                // If this text node was inside a ruby element, color the furigana too
                if (rubyElement && rubyElement.tagName === 'RUBY') {
                  // Find RT elements in this ruby and apply the same colors
                  const rtElements = rubyElement.querySelectorAll('rt');
                  for (const rt of rtElements) {
                    // Get the first color from nodeTokens (the base text color)
                    const baseColor =
                      nodeTokens.length > 0 ? nodeTokens[0].color : TokenColor.MATURE;
                    // Color all text in the RT element
                    const rtTextNodes = this._getTextNodesFromElement(rt);
                    for (const rtTextNode of rtTextNodes) {
                      if (rtTextNode.textContent && rtTextNode.parentElement) {
                        const rtColoredHtml = this._applyTokenStyle(
                          rtTextNode.textContent,
                          baseColor
                        );
                        const rtTemplate = document.createElement('template');
                        rtTemplate.innerHTML = rtColoredHtml;
                        const rtFragment = rtTemplate.content;
                        rtTextNode.parentElement.replaceChild(rtFragment, rtTextNode);
                      }
                    }
                  }
                }
              }

              textNodeStartPos = nodeEndPos;
            }

            element.setAttribute('data-anki-colored', 'true');
            resolve();
          });
        });
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

        // Check memory cache only (no persistent cache lookup)
        const cached = this.tokenColorCache.get(trimmedToken);
        if (cached !== undefined) {
          tokenColorMap.set(trimmedToken, cached);
          continue;
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
   * Get word data for a token, checking memory cache first, then IndexedDB
   * This makes IndexedDB the primary cache, with wordDataCache as a read-through cache
   * @param word - Word to lookup
   * @returns Word data if found, undefined otherwise
   */
  private async _getWordData(
    word: string
  ): Promise<{ status: 'mature' | 'young' | 'new' | 'unknown'; cardIds: number[] } | undefined> {
    // Check memory cache first (fast path)
    let wordData = this.wordDataCache.get(word);
    if (wordData) return wordData;

    // Fall back to IndexedDB (primary cache)
    if (this.cacheService) {
      wordData = await this.cacheService.getWordData(word);
      if (wordData) {
        // Populate memory cache for future lookups
        this.wordDataCache.set(word, wordData);
        return wordData;
      }
    }

    return undefined;
  }

  /**
   * Batch fetch token colors from Anki for multiple uncached tokens
   * Uses pre-built wordDataCache for instant lookups (no API calls!)
   * @param tokens - Array of uncached tokens
   * @param colorMap - Map to populate with token -> color mappings
   */
  private async _batchFetchTokenColors(
    tokens: string[],
    colorMap: Map<string, TokenColor>
  ): Promise<void> {
    const uncollectedTokens: string[] = [];

    // Look up tokens in pre-built wordDataCache (instant, no API calls!)
    for (const token of tokens) {
      // Look up word data from cache
      let wordData = await this._getWordData(token);

      // If no direct entry, try lemmas as a fallback (local cache -> persistent cache -> yomitan)
      if (!wordData || wordData.cardIds.length === 0) {
        try {
          let lemmas = this.lemmatizeCache.get(token);

          if (!lemmas && this.cacheService) {
            lemmas = await this.cacheService.getLemmas(token);
            if (lemmas) this.lemmatizeCache.set(token, lemmas);
          }

          if (!lemmas) {
            lemmas = await this.yomitan.lemmatize(token);
            this.lemmatizeCache.set(token, lemmas);
            if (this.cacheService) {
              await this.cacheService.setLemmas(token, lemmas);
            }
          }

          if (lemmas && lemmas.length > 0) {
            console.debug(`🔍 Token "${token}" lemmatized to:`, lemmas);
            // Try to find a lemma that exists in wordDataCache with cardIds
            for (const lemma of lemmas) {
              const lemmaData = await this._getWordData(lemma);
              console.debug(`🔍 Checking lemma "${lemma}":`, lemmaData);
              if (lemmaData && lemmaData.cardIds && lemmaData.cardIds.length > 0) {
                console.debug(`✅ Found data for lemma "${lemma}":`, lemmaData);
                wordData = lemmaData;
                break;
              }
            }
            if (!wordData || wordData.cardIds.length === 0) {
              console.debug(`❌ No lemma data found for token "${token}"`);
            }
          }
        } catch (err) {
          // Non-fatal; if lemmatization fails we'll treat token as uncollected below
          console.debug('Lemmatization fallback failed for token', token, err);
        }
      }

      if (!wordData || wordData.cardIds.length === 0) {
        // Still no data found -> will need further handling (e.g. batch lemmatize)
        uncollectedTokens.push(token);
        continue;
      }

      // Map status to color
      const color =
        wordData.status === 'mature'
          ? TokenColor.MATURE
          : wordData.status === 'young'
            ? TokenColor.YOUNG
            : wordData.status === 'new'
              ? TokenColor.UNKNOWN
              : TokenColor.UNCOLLECTED;

      console.debug(`🎨 Token "${token}" -> status: ${wordData.status}, color: ${color}`);

      if (color === TokenColor.UNCOLLECTED) {
        uncollectedTokens.push(token);
        continue;
      }

      // Cache and store (cache mapping is for the original token)
      this.tokenColorCache.set(token, color);
      colorMap.set(token, color);
    }

    // Handle uncollected tokens with lemmatization
    if (uncollectedTokens.length > 0) {
      await this._handleUncollectedTokensBatch(uncollectedTokens, colorMap);
    }
  }

  /**
   * Handle uncollected tokens by lemmatizing and checking lemmas
   * Uses pre-built stability cache for instant lookups (no API calls!)
   * @param tokens - Array of uncollected tokens
   * @param colorMap - Map to populate with token -> color mappings
   */
  private async _handleUncollectedTokensBatch(
    tokens: string[],
    colorMap: Map<string, TokenColor>
  ): Promise<void> {
    // Parallelize lemmatization
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

    // Look up lemmas using IndexedDB as primary cache
    // Process each uncollected token
    for (const token of tokens) {
      const lemmas = tokenToLemmas.get(token) || [];
      let finalColor = TokenColor.UNCOLLECTED;

      // Check each lemma - use the highest priority color found
      for (const lemma of lemmas) {
        const wordData = await this._getWordData(lemma);

        if (wordData && wordData.cardIds.length > 0) {
          // Map status to color
          const color =
            wordData.status === 'mature'
              ? TokenColor.MATURE
              : wordData.status === 'young'
                ? TokenColor.YOUNG
                : wordData.status === 'new'
                  ? TokenColor.UNKNOWN
                  : TokenColor.UNCOLLECTED;

          if (color === TokenColor.MATURE) {
            finalColor = TokenColor.MATURE;
            break; // Mature is highest priority, stop here
          } else if (color === TokenColor.YOUNG && finalColor === TokenColor.UNCOLLECTED) {
            finalColor = TokenColor.YOUNG;
          } else if (color === TokenColor.UNKNOWN && finalColor === TokenColor.UNCOLLECTED) {
            finalColor = TokenColor.UNKNOWN;
          }
        }

        if (finalColor === TokenColor.MATURE) break; // Already found mature, stop
      }

      // Cache and store
      this.tokenColorCache.set(token, finalColor);
      colorMap.set(token, finalColor);
    }
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
      style = TokenStyle.UNDERLINE;
    }

    // Preserve whitespace in the styled spans to maintain formatting
    const whiteSpaceStyle = 'white-space: pre-wrap;';

    switch (style) {
      case TokenStyle.TEXT:
        return `<span style="color: ${color}; ${whiteSpaceStyle}">${token}</span>`;
      case TokenStyle.UNDERLINE: {
        const decoration = color === TokenColor.ERROR ? 'double' : 'solid';
        return `<span style="text-decoration: underline ${color} ${decoration}; outline: inset ${color} 1px; ${whiteSpaceStyle}">${token}</span>`;
      }
      default:
        return token;
    }
  }

  /**
   * Get text nodes from a specific element (for RT elements)
   * @param element - Element to get text nodes from
   * @returns Array of text nodes
   */
  private _getTextNodesFromElement(element: Element): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Accept all text nodes in this element
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

        // Check if this text node is inside RT or RP elements (furigana/parentheses)
        // We need to check all ancestors up to the root element
        let current: Element | null = parent;
        while (current && current !== element) {
          if (current.tagName === 'RT' || current.tagName === 'RP') {
            return NodeFilter.FILTER_REJECT;
          }
          current = current.parentElement;
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
    this.wordDataCache.clear();

    // Also clear persistent cache
    if (this.cacheService) {
      await this.cacheService.clearAllCaches();
    }
  }

  private lastCacheRefreshTime = 0;
  private isReady = false;
  private readyPromise: Promise<void>;

  /**
   * Check IndexedDB cache status without preloading
   * Cache queries now happen on-demand via _getWordData
   * @returns Object with cache status
   */
  async loadCacheFromIndexedDB(): Promise<{
    loadedWords: number;
    needsRefresh: boolean;
    cacheAge: number;
  }> {
    console.log('📦 Checking IndexedDB cache status (no preload - queries on-demand)...');

    if (!this.cacheService) {
      console.warn('⚠️ No cache service available');
      return { loadedWords: 0, needsRefresh: true, cacheAge: Number.MAX_SAFE_INTEGER };
    }

    try {
      const db = await this.cacheService['db'];
      const tx = db.transaction('wordData', 'readonly');
      const store = tx.objectStore('wordData');
      const cursor = await store.openCursor();

      if (!cursor) {
        console.log('📦 No cache found in IndexedDB');
        return { loadedWords: 0, needsRefresh: true, cacheAge: Number.MAX_SAFE_INTEGER };
      }

      // Just check age, don't preload
      const oldestTimestamp = cursor.value.timestamp;
      const cacheAge = Date.now() - oldestTimestamp;

      console.log(
        `📦 Cache exists (age: ${Math.round(cacheAge / 60000)} min) - queries will happen on-demand`
      );

      // Return 0 loaded words since we're not preloading anymore
      return { loadedWords: 0, needsRefresh: true, cacheAge };
    } catch (error) {
      console.error('❌ Failed to check cache status:', error);
      return { loadedWords: 0, needsRefresh: true, cacheAge: Number.MAX_SAFE_INTEGER };
    }
  }

  /**
   * Re-colorize elements that were already processed
   * Useful after cache has been loaded/refreshed to update colors
   */
  async recolorizeProcessedElements(): Promise<void> {
    // Small delay to ensure DOM is settled
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clear token color cache to force fresh lookups from IndexedDB
    // This ensures all tokens are recomputed with the latest data
    this.tokenColorCache.clear();
    console.log('🔄 Cleared token color cache to force fresh lookups from IndexedDB');

    console.log('🔄 Re-colorizing already processed elements with updated cache...');
    console.log(
      `📊 Cache stats: ${this.wordDataCache.size} words in memory, querying IndexedDB on miss`
    );

    // Find all elements that were already colored
    const coloredElements = Array.from(document.querySelectorAll('[data-anki-colored="true"]'));

    if (coloredElements.length === 0) {
      console.log('🔄 No elements to re-colorize (none have been processed yet)');
      return;
    }

    // Remove the marker and actually re-colorize them
    coloredElements.forEach((element) => {
      element.removeAttribute('data-anki-colored');
    });

    console.log(`🔄 Re-colorizing ${coloredElements.length} elements with cached data...`);

    // Re-colorize all these elements in one batch
    await this.colorizeElementsBatch(coloredElements);

    console.log(`✅ Re-colorized ${coloredElements.length} elements successfully`);
  }

  /**
   * Preemptively warm the cache with all cards from configured Anki decks
   * Builds stability cache and word caches for faster future lookups
   * This should run in the background after loading cached data
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
      const deckNames = this.anki.getWordDecks();
      const wordFields = this.anki.getWordFields();
      console.log('Deck names:', deckNames);
      console.log('Word fields:', wordFields);
      console.log('Mature threshold:', this.options.matureThreshold);

      // Early validation
      if (!deckNames || deckNames.length === 0) {
        console.warn('❌ No deck names configured! Cache warming aborted.');
        console.warn('Please configure deck names in Settings > Anki Integration');
        return { totalCards: 0, cachedWords: 0, duration: Date.now() - startTime };
      }

      if (!wordFields || wordFields.length === 0) {
        console.warn('❌ No word fields configured! Cache warming aborted.');
        console.warn('Please configure word fields in Settings > Anki Integration');
        return { totalCards: 0, cachedWords: 0, duration: Date.now() - startTime };
      }

      // Step 0: Test Anki Connect connection
      console.log('🔌 Testing Anki Connect connection...');
      try {
        const version = await this.anki.version();
        console.log(`✅ Anki Connect version ${version} connected`);
      } catch (error) {
        console.error('❌ Failed to connect to Anki Connect:', error);
        console.error('Make sure Anki is running and AnkiConnect addon is installed');
        throw new Error(`Anki Connect connection failed: ${error}`);
      }

      // Step 1: Get all cards from configured decks (for field values)
      console.log('✅ Configuration valid. Step 1: Fetching all cards from decks...');
      const allCards = await this.anki.getAllCardsFromDecks();
      console.log(`Got ${allCards.length} cards from getAllCardsFromDecks`);

      if (allCards.length === 0) {
        console.warn('No cards found for cache warming');
        return { totalCards: 0, cachedWords: 0, duration: Date.now() - startTime };
      }

      console.log(`Found ${allCards.length} cards. Populating cache...`);

      // Extract unique words from configured word fields
      const wordToCardIds = new Map<string, number[]>();

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

      // Step 2: Build stability cache using prop:s queries
      console.log('Step 2: Building stability cache with 3 prop:s queries...');
      const stabilityCache = await this.anki.buildStabilityCacheForDecks(
        this.options.matureThreshold
      );
      console.log(`Stability cache has ${stabilityCache.size} card entries`);

      // Step 3: Build single cache: word -> {status, cardIds}
      console.log('Step 3: Mapping words to status...');
      let matureCount = 0,
        youngCount = 0,
        newCount = 0,
        unknownCount = 0;

      for (const [word, cardIds] of wordToCardIds.entries()) {
        // Determine status from stability cache (prefer mature > young > new > unknown)
        let status: 'mature' | 'young' | 'new' | 'unknown' = 'unknown';

        // Check cards against stability categories from prop:s queries
        for (const cardId of cardIds) {
          const category = stabilityCache.get(cardId);

          if (category === 'mature') {
            status = 'mature';
            break; // Mature is highest priority
          } else if (category === 'young' && status === 'unknown') {
            status = 'young';
          } else if (category === 'new' && status === 'unknown') {
            status = 'new';
          }
        }

        // Count by status
        if (status === 'mature') matureCount++;
        else if (status === 'young') youngCount++;
        else if (status === 'new') newCount++;
        else unknownCount++;

        // Store in single combined cache
        this.wordDataCache.set(word, { status, cardIds });

        // Store in persistent cache
        if (this.cacheService) {
          await this.cacheService.setWordData(word, status, cardIds);
        }

        cachedWords++;
      }

      console.log(
        `Words by status: ${matureCount} mature, ${youngCount} young, ${newCount} new, ${unknownCount} unknown`
      );

      // Clear token color cache so all tokens are recomputed with updated wordDataCache
      // This fixes the issue where tokens like "見て" were cached as UNCOLLECTED before their lemma "見る" was loaded.
      this.tokenColorCache.clear();
      console.log('🔄 Cleared token color cache to force recomputation with updated word data');

      const duration = Date.now() - startTime;
      console.log(`Cache warming complete: ${cachedWords} words cached in ${duration}ms`);

      return { totalCards: allCards.length, cachedWords, duration };
    } catch (error) {
      console.error('Error during cache warming:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      const duration = Date.now() - startTime;
      return { totalCards: 0, cachedWords, duration };
    }
  }
}
