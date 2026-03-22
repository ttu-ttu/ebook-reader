/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Yomitan } from '$lib/data/yomitan';
import {
  Anki,
  type CardInfo,
  type GetAllCardsProgress,
  type RepositionNewCardsResult
} from '$lib/data/anki';
import {
  TokenColor,
  TokenColorMode,
  TokenColorPalette,
  TokenStyle,
  type WordStatus
} from '$lib/data/anki/token-color';
import type { AnkiCacheService } from '$lib/data/database/anki-cache-db';
import type {
  CachedLemmas,
  CachedWordData
} from '$lib/data/database/anki-cache-db/anki-cache.service';

/** Regex to check if text contains letters */
const HAS_LETTER_REGEX = /\p{L}/u;
const HAS_KANJI_REGEX = /[\p{Script=Han}々]/u;
const HAS_KANA_REGEX = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SHARED_TOKEN_RESOLUTION_OPTIONS = { allowTermEntriesEnrichment: true } as const;

export interface ColoringOptions {
  enabled: boolean;
  yomitanUrl: string;
  ankiConnectUrl: string;
  wordFields: string[];
  wordDeckNames: string[];
  colorMode: TokenColorMode;
  desiredRetention: number;
  matureThreshold: number;
  tokenStyle: TokenStyle;
  colorPalette: TokenColorPalette;
}

export type DocumentTokenStatus = 'uncollected' | 'new' | 'young' | 'mature' | 'unknown';

export interface DocumentTokenAnalysisEntry {
  token: string;
  count: number;
  firstOccurrence: number;
  status: DocumentTokenStatus;
  due: boolean;
  cardIds: number[];
}

export interface DocumentTokenAnalysisProgress {
  completedSteps: number;
  totalSteps: number;
  percentage: number;
  phase: 'tokenize' | 'resolve';
}

export interface DocumentTokenAnalysisResult {
  entries: DocumentTokenAnalysisEntry[];
  totalTokens: number;
  uniqueTokens: number;
}

export interface DocumentTokenizeProgress {
  completedSteps: number;
  totalSteps: number;
  percentage: number;
}

export interface WarmCacheProgress {
  phase: 'fetch-cards' | 'process-words';
  percentage: number;
  completed: number;
  total: number;
  detail: string;
}

export interface BuildRepositionOrderOptions {
  signal?: AbortSignal;
  chunkSize?: number;
  scanLength?: number;
  maxTokens?: number;
  maxChars?: number;
  orderMode?: 'book-order' | 'occurrences';
  minOccurrences?: number;
}

export interface BuildRepositionOrderResult {
  orderedCardIds: number[];
  processedTokens: number;
  processedChars: number;
  uniqueTokens: number;
}

interface GradeDialogInfo {
  cardId: number;
  deckName: string;
  fieldLabel: string;
  fieldValue: string;
  retrievability: string;
  stability: string;
  lastReviewed: string;
  nextExpectedReview: string;
}

type GradeDialogAction =
  | { type: 'cancel' }
  | { type: 'open-browser' }
  | { type: 'grade'; ease: 1 | 2 | 3 | 4 };

/**
 * Service for coloring book content based on Anki card retrievability
 * Based on asbplayer token coloring implementation
 */
export class BookContentColoring {
  private yomitan: Yomitan;
  private anki: Anki;
  private cacheService?: AnkiCacheService;
  private options: ColoringOptions;
  private readonly warmCacheVersion = 'word-cache-v3';
  private readonly warmCacheVersionStorageKey = 'anki-warm-cache-version';
  private readonly warmCacheUpdatedAtStorageKey = 'anki-warm-cache-updated-at';
  // Rate limiting: track last refresh timestamp for each token
  private lastRefreshTime = new Map<string, number>();
  private readonly REFRESH_COOLDOWN_MS = 5000; // 5 seconds
  private readonly LEMMA_WORDDATA_MISS_LOG_COOLDOWN_MS = 30000; // 30 seconds
  private lemmaWordDataMissLogTime = new Map<string, number>();

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

  setColorPalette(colorPalette: TokenColorPalette): void {
    if (this.options.colorPalette === colorPalette) {
      return;
    }

    this.options.colorPalette = colorPalette;
  }

  async setColorMode(colorMode: TokenColorMode): Promise<void> {
    if (this.options.colorMode === colorMode) {
      return;
    }

    this.options.colorMode = colorMode;
    await this.clearCache();
  }

  async setDesiredRetention(desiredRetention: number): Promise<void> {
    const normalizedRetention = this._normalizeDesiredRetention(desiredRetention);
    if (this.options.desiredRetention === normalizedRetention) {
      return;
    }

    this.options.desiredRetention = normalizedRetention;
    await this.clearCache();
  }

  getDesiredRetention(): number {
    return this._normalizeDesiredRetention(this.options.desiredRetention);
  }

  async setMatureThreshold(matureThreshold: number): Promise<void> {
    const normalizedThreshold = this._normalizeMatureThreshold(matureThreshold);
    if (this.options.matureThreshold === normalizedThreshold) {
      return;
    }

    this.options.matureThreshold = normalizedThreshold;
    await this.clearCache();
  }

  getMatureThreshold(): number {
    return this._normalizeMatureThreshold(this.options.matureThreshold);
  }

  /**
   * Build retrievability cache for all cards in configured decks
   * Should be called once on initialization for optimal performance
   * @returns Promise with cache statistics
   */
  async buildStabilityCache(): Promise<{
    matureCards: number;
    youngCards: number;
    newCards: number;
    dueCards: number;
  }> {
    try {
      const retrievabilityCache = await this.anki.buildRetrievabilityCacheForDecks(
        this.getDesiredRetention()
      );

      const matureCards = Array.from(retrievabilityCache.values()).filter(
        (c) => c === 'mature'
      ).length;
      const youngCards = Array.from(retrievabilityCache.values()).filter(
        (c) => c === 'young'
      ).length;
      const newCards = Array.from(retrievabilityCache.values()).filter((c) => c === 'new').length;
      const dueCards = Array.from(retrievabilityCache.values()).filter((c) => c === 'due').length;

      return { matureCards, youngCards, newCards, dueCards };
    } catch (error) {
      console.error('Error building retrievability cache:', error);
      return { matureCards: 0, youngCards: 0, newCards: 0, dueCards: 0 };
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
      `🎨 colorizeElementsBatch called with ${elements.length} elements (IndexedDB mode)`
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

        // Debug: log if combined text contains specific characters
        if (combinedText.includes('嫉') || combinedText.includes('妬')) {
          console.log(`🔍 DEBUG: Combined text contains 嫉/妬:`);
          console.log(`  Combined text: "${combinedText}"`);
          console.log(`  Tokens:`, tokens);
        }

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
      const uncachedTokens = Array.from(allTokens);

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
            // Build a map of character position -> token info (including token index)
            let currentPos = 0;
            const positionColorMap = new Map<
              number,
              { token: string; color: TokenColor; tokenIndex: number }
            >();

            for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
              const rawToken = tokens[tokenIdx];
              const trimmed = rawToken.trim();
              const color = HAS_LETTER_REGEX.test(trimmed)
                ? globalColorMap.get(trimmed) || TokenColor.UNKNOWN
                : TokenColor.UNKNOWN;

              // Map each character position in this token to its color and token index
              for (let charIdx = 0; charIdx < rawToken.length; charIdx++) {
                positionColorMap.set(currentPos + charIdx, {
                  token: rawToken,
                  color,
                  tokenIndex: tokenIdx
                });
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
              let currentTokenIndex: number | null = null;

              for (let pos = textNodeStartPos; pos < nodeEndPos; pos++) {
                const posInfo = positionColorMap.get(pos);
                if (!posInfo) continue;

                // If color OR token index changes, save the current token and start a new one
                if (
                  currentColor !== null &&
                  (currentColor !== posInfo.color || currentTokenIndex !== posInfo.tokenIndex)
                ) {
                  nodeTokens.push({ text: currentToken, color: currentColor });
                  currentToken = '';
                }

                currentToken += nodeText[pos - textNodeStartPos];
                currentColor = posInfo.color;
                currentTokenIndex = posInfo.tokenIndex;
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
                // Replace the text node with colored HTML
                const template = document.createElement('template');
                template.innerHTML = coloredHtml;
                const fragment = template.content;
                textNode.parentElement.replaceChild(fragment, textNode);
              }

              textNodeStartPos = nodeEndPos;
            }

            element.setAttribute('data-anki-colored', 'true');

            // Attach hover event listeners to all token spans for on-demand refresh
            this._attachHoverListeners(element);

            resolve();
          });
        });
      }
    } catch (error) {
      console.error('Error colorizing elements batch:', error);
    }
  }

  async analyzeDocumentText(
    text: string,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: DocumentTokenAnalysisProgress) => void;
      chunkSize?: number;
      batchSize?: number;
      scanLength?: number;
      tokenCountCacheKey?: string;
    }
  ): Promise<DocumentTokenAnalysisResult> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return { entries: [], totalTokens: 0, uniqueTokens: 0 };
    }

    const chunkSize = options?.chunkSize ?? 12000;
    const batchSize = options?.batchSize ?? 250;
    const scanLength = options?.scanLength ?? 4096;
    const textChunks = this._chunkDocumentText(normalizedText, chunkSize);
    const tokenCountCacheKey = options?.tokenCountCacheKey?.trim();
    const uniqueCounts = new Map<string, number>();
    let completedSteps = 0;
    let totalTokens = 0;

    const reportProgress = (phase: 'tokenize' | 'resolve', completed: number, total: number) => {
      options?.onProgress?.({
        completedSteps: completed,
        totalSteps: total,
        percentage: total === 0 ? 100 : Math.round((completed / total) * 100),
        phase
      });
    };

    let totalSteps = textChunks.length;
    let loadedTokenCountsFromCache = false;

    if (tokenCountCacheKey && this.cacheService) {
      const cachedTokenCounts = await this.cacheService.getDocumentTokenCounts(tokenCountCacheKey);
      if (cachedTokenCounts && cachedTokenCounts.entries.length > 0) {
        for (const entry of cachedTokenCounts.entries) {
          const token = entry.token?.trim();
          const count = Number.isFinite(entry.count) ? Math.trunc(entry.count) : 0;

          if (!token || !HAS_LETTER_REGEX.test(token) || count <= 0) {
            continue;
          }

          uniqueCounts.set(token, count);
          totalTokens += count;
        }

        if (uniqueCounts.size > 0) {
          loadedTokenCountsFromCache = true;
        }
      }
    }

    if (!loadedTokenCountsFromCache) {
      for (const chunk of textChunks) {
        this._throwIfAborted(options?.signal);
        const tokens = await this.yomitan.tokenize(chunk, undefined, scanLength);

        for (const token of tokens) {
          const trimmedToken = token.trim();
          if (!HAS_LETTER_REGEX.test(trimmedToken)) {
            continue;
          }

          uniqueCounts.set(trimmedToken, (uniqueCounts.get(trimmedToken) || 0) + 1);
          totalTokens++;
        }

        completedSteps++;
        reportProgress('tokenize', completedSteps, totalSteps);
      }

      if (tokenCountCacheKey && this.cacheService && uniqueCounts.size > 0) {
        const entries = Array.from(uniqueCounts.entries()).map(([token, count]) => ({
          token,
          count
        }));
        await this.cacheService.setDocumentTokenCounts(tokenCountCacheKey, entries, totalTokens);
      }
    } else {
      completedSteps = textChunks.length;
      reportProgress('tokenize', completedSteps, totalSteps);
    }

    const uniqueTokens = Array.from(uniqueCounts.keys());
    const tokenFirstOccurrence = new Map<string, number>(
      uniqueTokens.map((token, index) => [token, index])
    );
    const resolveBatches = this._chunkArray(uniqueTokens, batchSize);
    totalSteps = textChunks.length + Math.max(1, resolveBatches.length);
    const analysisEntries: DocumentTokenAnalysisEntry[] = [];

    if (resolveBatches.length > 0) {
      reportProgress('resolve', completedSteps, totalSteps);
    }

    for (const batch of resolveBatches) {
      this._throwIfAborted(options?.signal);
      const tokenData = await this._resolveTokenAnalysisData(batch);

      for (const token of batch) {
        const resolved = tokenData.get(token) || {
          status: 'uncollected' as const,
          due: false,
          cardIds: []
        };
        analysisEntries.push({
          token,
          count: uniqueCounts.get(token) || 0,
          firstOccurrence: tokenFirstOccurrence.get(token) ?? Number.MAX_SAFE_INTEGER,
          status: resolved.status,
          due: resolved.due,
          cardIds: resolved.cardIds
        });
      }

      completedSteps++;
      reportProgress('resolve', completedSteps, totalSteps);
    }

    analysisEntries.sort((a, b) => b.count - a.count || a.token.localeCompare(b.token, 'ja'));

    return {
      entries: analysisEntries,
      totalTokens,
      uniqueTokens: analysisEntries.length
    };
  }

  async preTokenizeDocument(
    text: string,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: DocumentTokenizeProgress) => void;
      chunkSize?: number;
      scanLength?: number;
      tokenCountCacheKey?: string;
    }
  ): Promise<{ totalTokens: number; uniqueTokens: number }> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      options?.onProgress?.({
        completedSteps: 0,
        totalSteps: 0,
        percentage: 100
      });
      return {
        totalTokens: 0,
        uniqueTokens: 0
      };
    }

    const chunkSize = options?.chunkSize ?? 12000;
    const scanLength = options?.scanLength ?? 4096;
    const textChunks = this._chunkDocumentText(normalizedText, chunkSize);
    const totalSteps = Math.max(1, textChunks.length);
    const uniqueCounts = new Map<string, number>();
    let totalTokens = 0;
    let completedSteps = 0;

    const reportProgress = () => {
      options?.onProgress?.({
        completedSteps,
        totalSteps,
        percentage: Math.round((completedSteps / totalSteps) * 100)
      });
    };

    reportProgress();

    for (const chunk of textChunks) {
      this._throwIfAborted(options?.signal);
      const tokens = await this.yomitan.tokenize(chunk, undefined, scanLength);

      for (const token of tokens) {
        const trimmedToken = token.trim();
        if (!HAS_LETTER_REGEX.test(trimmedToken)) {
          continue;
        }

        uniqueCounts.set(trimmedToken, (uniqueCounts.get(trimmedToken) || 0) + 1);
        totalTokens++;
      }

      completedSteps++;
      reportProgress();
    }

    const tokenCountCacheKey = options?.tokenCountCacheKey?.trim();
    if (tokenCountCacheKey && this.cacheService && uniqueCounts.size > 0) {
      const entries = Array.from(uniqueCounts.entries()).map(([token, count]) => ({
        token,
        count
      }));
      await this.cacheService.setDocumentTokenCounts(tokenCountCacheKey, entries, totalTokens);
    }

    return {
      totalTokens,
      uniqueTokens: uniqueCounts.size
    };
  }

  async buildRepositionOrderForNewCards(
    text: string,
    options?: BuildRepositionOrderOptions
  ): Promise<BuildRepositionOrderResult> {
    if (!text.trim()) {
      return {
        orderedCardIds: [],
        processedTokens: 0,
        processedChars: 0,
        uniqueTokens: 0
      };
    }

    const maxChars =
      typeof options?.maxChars === 'number' &&
      Number.isFinite(options.maxChars) &&
      options.maxChars > 0
        ? Math.max(1, Math.trunc(options.maxChars))
        : undefined;
    const maxTokens =
      typeof options?.maxTokens === 'number' &&
      Number.isFinite(options.maxTokens) &&
      options.maxTokens > 0
        ? Math.max(1, Math.trunc(options.maxTokens))
        : undefined;

    const scanText = maxChars ? text.slice(0, maxChars) : text;
    const chunkSize = options?.chunkSize ?? 12000;
    const scanLength = options?.scanLength ?? 4096;
    const orderMode = options?.orderMode === 'occurrences' ? 'occurrences' : 'book-order';
    const minOccurrences =
      typeof options?.minOccurrences === 'number' &&
      Number.isFinite(options.minOccurrences) &&
      options.minOccurrences > 0
        ? Math.max(1, Math.trunc(options.minOccurrences))
        : 2;
    const textChunks = this._chunkDocumentText(scanText, chunkSize);

    const tokenStream: string[] = [];
    const tokenCounts = new Map<string, number>();
    const tokenFirstOccurrence = new Map<string, number>();
    let processedChars = 0;
    let reachedTokenLimit = false;

    for (const chunk of textChunks) {
      this._throwIfAborted(options?.signal);
      const tokens = await this.yomitan.tokenize(chunk, undefined, scanLength);
      let chunkCharsConsumed = 0;

      for (const token of tokens) {
        chunkCharsConsumed += token.length;
        const trimmedToken = token.trim();
        if (!HAS_LETTER_REGEX.test(trimmedToken)) {
          continue;
        }

        tokenStream.push(trimmedToken);
        tokenCounts.set(trimmedToken, (tokenCounts.get(trimmedToken) || 0) + 1);
        if (!tokenFirstOccurrence.has(trimmedToken)) {
          tokenFirstOccurrence.set(trimmedToken, tokenStream.length - 1);
        }

        if (maxTokens && tokenStream.length >= maxTokens) {
          reachedTokenLimit = true;
          break;
        }
      }

      processedChars += Math.min(chunk.length, Math.max(0, chunkCharsConsumed));
      if (reachedTokenLimit) {
        break;
      }
    }

    const uniqueTokens = Array.from(new Set(tokenStream));
    const tokenResolution = await this._resolveTokenAnalysisData(uniqueTokens);
    const filteredTokens = uniqueTokens.filter(
      (token) => (tokenCounts.get(token) || 0) >= minOccurrences
    );
    const sortedTokens = filteredTokens.sort((left, right) => {
      if (orderMode === 'occurrences') {
        const countDiff = (tokenCounts.get(right) || 0) - (tokenCounts.get(left) || 0);
        if (countDiff !== 0) {
          return countDiff;
        }
      }

      const leftPos = tokenFirstOccurrence.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightPos = tokenFirstOccurrence.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftPos - rightPos;
    });

    const orderedCardIds: number[] = [];
    const seenCardIds = new Set<number>();

    for (const token of sortedTokens) {
      const resolved = tokenResolution.get(token);
      if (!resolved || !Array.isArray(resolved.cardIds) || resolved.cardIds.length === 0) {
        continue;
      }

      for (const cardId of resolved.cardIds) {
        if (!Number.isFinite(cardId) || seenCardIds.has(cardId)) {
          continue;
        }
        seenCardIds.add(cardId);
        orderedCardIds.push(cardId);
      }
    }

    return {
      orderedCardIds,
      processedTokens: tokenStream.length,
      processedChars: Math.min(scanText.length, processedChars),
      uniqueTokens: uniqueTokens.length
    };
  }

  async repositionNewCardsByOrder(
    orderedCardIds: number[],
    options?: {
      startPosition?: number;
      step?: number;
      shift?: boolean;
    }
  ): Promise<RepositionNewCardsResult> {
    return this.anki.repositionNewCards({
      orderedCardIds,
      startPosition: Math.max(1, Math.trunc(options?.startPosition ?? 1)),
      step: Math.max(1, Math.trunc(options?.step ?? 1)),
      shift: options?.shift ?? true
    });
  }

  async refreshTokenAnalysisFromAnki(token: string): Promise<{
    status: DocumentTokenStatus;
    due: boolean;
    cardIds: number[];
  }> {
    const trimmedToken = token.trim();
    if (!HAS_LETTER_REGEX.test(trimmedToken)) {
      return { status: 'uncollected', due: false, cardIds: [] };
    }

    await this._refreshTokenWordDataFromAnki(trimmedToken);
    const resolved = await this._resolveTokenAnalysisData([trimmedToken]);
    return resolved.get(trimmedToken) || { status: 'uncollected', due: false, cardIds: [] };
  }

  /**
   * Attach interaction event listeners to token spans
   * @param element - Root element containing token spans
   */
  private _attachHoverListeners(element: Element): void {
    const tokenSpans = element.querySelectorAll('[data-anki-token]');

    for (const span of tokenSpans) {
      const token = span.getAttribute('data-anki-token');
      if (!token) continue;
      if (!HAS_LETTER_REGEX.test(token.trim())) continue;

      // Add mouseenter listener to refresh token on hover
      span.addEventListener('mouseenter', async () => {
        await this._refreshToken(token, span as HTMLElement);
      });

      // Add double-click listener to grade token in Anki
      span.addEventListener('dblclick', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this._gradeToken(token, span as HTMLElement);
      });
    }
  }

  private _ensureGradeDialogStyle(): void {
    if (document.getElementById('anki-grade-dialog-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'anki-grade-dialog-style';
    style.textContent = `
      .anki-grade-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(8, 10, 14, 0.6);
        backdrop-filter: blur(4px);
      }

      .anki-grade-modal {
        width: min(520px, 100%);
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background:
          radial-gradient(circle at top right, rgba(99, 102, 241, 0.25), transparent 55%),
          linear-gradient(145deg, rgba(23, 27, 36, 0.98), rgba(13, 16, 24, 0.98));
        color: #f8fafc;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
        padding: 1rem;
      }

      .anki-grade-header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
      }

      .anki-grade-title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
      }

      .anki-grade-subtitle {
        margin: 0.2rem 0 0;
        color: rgba(226, 232, 240, 0.88);
        font-size: 0.9rem;
      }

      .anki-grade-token {
        margin: 0.9rem 0 1rem;
        padding: 0.8rem 0.9rem;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(2, 6, 23, 0.5);
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        word-break: break-word;
      }

      .anki-grade-note {
        margin: 0.85rem 0 1rem;
        padding: 0.8rem 0.9rem;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(15, 23, 42, 0.55);
        color: rgba(226, 232, 240, 0.96);
        font-size: 0.9rem;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .anki-grade-info {
        margin-bottom: 0.9rem;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: rgba(15, 23, 42, 0.6);
        overflow: hidden;
      }

      .anki-grade-info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        padding: 0.58rem 0.75rem;
        font-size: 0.84rem;
      }

      .anki-grade-info-row + .anki-grade-info-row {
        border-top: 1px solid rgba(148, 163, 184, 0.2);
      }

      .anki-grade-info-label {
        color: rgba(148, 163, 184, 0.95);
      }

      .anki-grade-info-value {
        color: rgba(248, 250, 252, 0.96);
        font-weight: 600;
        text-align: right;
        overflow-wrap: anywhere;
      }

      .anki-grade-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem;
        margin-bottom: 0.8rem;
      }

      .anki-grade-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        width: 100%;
        border-radius: 12px;
        border: 1px solid transparent;
        color: #f8fafc;
        padding: 0.75rem 0.8rem;
        font-size: 0.92rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 140ms ease, filter 140ms ease, border-color 140ms ease;
      }

      .anki-grade-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.06);
      }

      .anki-grade-btn:active {
        transform: translateY(0);
      }

      .anki-grade-btn[data-ease="1"] {
        background: linear-gradient(135deg, #7f1d1d, #b91c1c);
        border-color: rgba(254, 202, 202, 0.35);
      }

      .anki-grade-btn[data-ease="2"] {
        background: linear-gradient(135deg, #92400e, #d97706);
        border-color: rgba(254, 243, 199, 0.35);
      }

      .anki-grade-btn[data-ease="3"] {
        background: linear-gradient(135deg, #065f46, #059669);
        border-color: rgba(209, 250, 229, 0.35);
      }

      .anki-grade-btn[data-ease="4"] {
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        border-color: rgba(219, 234, 254, 0.35);
      }

      .anki-grade-key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.2);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .anki-grade-footer {
        display: flex;
        justify-content: space-between;
        gap: 0.6rem;
      }

      .anki-grade-cancel {
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: 10px;
        background: rgba(148, 163, 184, 0.12);
        color: #f1f5f9;
        padding: 0.5rem 0.75rem;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
      }

      .anki-grade-browser {
        border: 1px solid rgba(99, 102, 241, 0.4);
        border-radius: 10px;
        background: rgba(59, 130, 246, 0.18);
        color: #dbeafe;
        padding: 0.5rem 0.75rem;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
      }

      .anki-grade-close {
        border: none;
        background: transparent;
        color: rgba(248, 250, 252, 0.9);
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
      }

      @media (max-width: 480px) {
        .anki-grade-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private _showGradeDialog(token: string, info: GradeDialogInfo): Promise<GradeDialogAction> {
    if (typeof document === 'undefined') {
      return Promise.resolve({ type: 'cancel' });
    }

    this._ensureGradeDialogStyle();

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'anki-grade-overlay';
      overlay.innerHTML = `
        <div class="anki-grade-modal" role="dialog" aria-modal="true" aria-label="Grade card">
          <div class="anki-grade-header">
            <div>
              <p class="anki-grade-title">Grade Card</p>
              <p class="anki-grade-subtitle">Choose a rating to send to Anki</p>
            </div>
            <button type="button" class="anki-grade-close" aria-label="Close">✕</button>
          </div>
          <div class="anki-grade-token">${this._escapeHtml(token)}</div>
          <div class="anki-grade-info">
            <div class="anki-grade-info-row">
              <span class="anki-grade-info-label">Card ID</span>
              <span class="anki-grade-info-value">${info.cardId}</span>
            </div>
            <div class="anki-grade-info-row">
              <span class="anki-grade-info-label">Deck</span>
              <span class="anki-grade-info-value">${this._escapeHtml(info.deckName)}</span>
            </div>
            <div class="anki-grade-info-row">
              <span class="anki-grade-info-label">${this._escapeHtml(info.fieldLabel)}</span>
              <span class="anki-grade-info-value">${this._escapeHtml(info.fieldValue)}</span>
            </div>
            <div class="anki-grade-info-row">
              <span class="anki-grade-info-label">Retrievability</span>
              <span class="anki-grade-info-value">${this._escapeHtml(info.retrievability)}</span>
            </div>
            <div class="anki-grade-info-row">
              <span class="anki-grade-info-label">Stability</span>
              <span class="anki-grade-info-value">${this._escapeHtml(info.stability)}</span>
            </div>
            <div class="anki-grade-info-row">
              <span class="anki-grade-info-label">Last Reviewed</span>
              <span class="anki-grade-info-value">${this._escapeHtml(info.lastReviewed)}</span>
            </div>
            <div class="anki-grade-info-row">
              <span class="anki-grade-info-label">Next Expected Review</span>
              <span class="anki-grade-info-value">${this._escapeHtml(info.nextExpectedReview)}</span>
            </div>
          </div>
          <div class="anki-grade-grid">
            <button type="button" class="anki-grade-btn" data-ease="1"><span>Again</span><span class="anki-grade-key">1</span></button>
            <button type="button" class="anki-grade-btn" data-ease="2"><span>Hard</span><span class="anki-grade-key">2</span></button>
            <button type="button" class="anki-grade-btn" data-ease="3"><span>Good</span><span class="anki-grade-key">3</span></button>
            <button type="button" class="anki-grade-btn" data-ease="4"><span>Easy</span><span class="anki-grade-key">4</span></button>
          </div>
          <div class="anki-grade-footer">
            <button type="button" class="anki-grade-browser">Open in Anki Browser</button>
            <button type="button" class="anki-grade-cancel">Cancel</button>
          </div>
        </div>
      `;

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          cleanup({ type: 'cancel' });
          return;
        }

        if (event.key >= '1' && event.key <= '4') {
          cleanup({ type: 'grade', ease: Number.parseInt(event.key, 10) as 1 | 2 | 3 | 4 });
        }
      };

      const cleanup = (value: GradeDialogAction) => {
        window.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve(value);
      };

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          cleanup({ type: 'cancel' });
        }
      });

      overlay
        .querySelector('.anki-grade-close')
        ?.addEventListener('click', () => cleanup({ type: 'cancel' }));
      overlay
        .querySelector('.anki-grade-cancel')
        ?.addEventListener('click', () => cleanup({ type: 'cancel' }));
      overlay
        .querySelector('.anki-grade-browser')
        ?.addEventListener('click', () => cleanup({ type: 'open-browser' }));

      overlay.querySelectorAll('.anki-grade-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const easeAttr = (button as HTMLElement).dataset.ease;
          if (!easeAttr) {
            cleanup({ type: 'cancel' });
            return;
          }

          const parsedEase = Number.parseInt(easeAttr, 10);
          if ([1, 2, 3, 4].includes(parsedEase)) {
            cleanup({ type: 'grade', ease: parsedEase as 1 | 2 | 3 | 4 });
          } else {
            cleanup({ type: 'cancel' });
          }
        });
      });

      window.addEventListener('keydown', onKeyDown);
      document.body.appendChild(overlay);
    });
  }

  private _showNoticeDialog(title: string, message: string, subtitle = ''): Promise<void> {
    if (typeof document === 'undefined') {
      return Promise.resolve();
    }

    this._ensureGradeDialogStyle();

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'anki-grade-overlay';
      overlay.innerHTML = `
        <div class="anki-grade-modal" role="dialog" aria-modal="true" aria-label="${this._escapeHtml(title)}">
          <div class="anki-grade-header">
            <div>
              <p class="anki-grade-title">${this._escapeHtml(title)}</p>
              ${subtitle ? `<p class="anki-grade-subtitle">${this._escapeHtml(subtitle)}</p>` : ''}
            </div>
            <button type="button" class="anki-grade-close" aria-label="Close">✕</button>
          </div>
          <div class="anki-grade-note">${this._escapeHtml(message)}</div>
          <div class="anki-grade-footer">
            <span></span>
            <button type="button" class="anki-grade-cancel">Close</button>
          </div>
        </div>
      `;

      const cleanup = () => {
        window.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve();
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Enter') {
          cleanup();
        }
      };

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          cleanup();
        }
      });

      overlay.querySelector('.anki-grade-close')?.addEventListener('click', cleanup);
      overlay.querySelector('.anki-grade-cancel')?.addEventListener('click', cleanup);
      window.addEventListener('keydown', onKeyDown);
      document.body.appendChild(overlay);
    });
  }

  private async _buildGradeDialogInfo(
    cardId: number,
    _status: WordStatus
  ): Promise<GradeDialogInfo> {
    const cardInfos = await this.anki.cardsInfo([cardId], ['prop:r', 'prop:s'], undefined, {
      noteFields: this.options.wordFields,
      retrievedInfoMode: 'COMPACT'
    });
    const cardInfo = cardInfos[0];

    const deckName = cardInfo?.deckName || 'Unknown Deck';
    const preferredField = this._extractPreferredField(cardInfo);
    const fieldLabel = preferredField?.name ? `Field (${preferredField.name})` : 'Field Value';
    const fieldValue = preferredField?.value || 'Unavailable';
    const rawPropR = cardInfo?.['prop:r'];
    const rawPropS = cardInfo?.['prop:s'];
    const exactRetrievability = typeof rawPropR === 'number' ? rawPropR : undefined;
    const isNewCard = (cardInfo?.queue === 0 || cardInfo?.type === 0) && rawPropR === null;

    const retrievability = this._formatRetrievabilityText(exactRetrievability, isNewCard);
    const stability = this._formatStabilityText(
      typeof rawPropS === 'number' ? rawPropS : undefined,
      cardInfo?.interval
    );

    let lastReviewed = 'Never reviewed';
    let latestReviewMs: number | undefined;
    try {
      const reviewsByCard = await this.anki.getReviewsOfCards([cardId]);
      const reviews = reviewsByCard[String(cardId)] || [];
      if (reviews.length > 0) {
        latestReviewMs = Math.max(...reviews.map((review) => review.id || 0));
        if (latestReviewMs > 0) {
          lastReviewed = this._formatTimestampMs(latestReviewMs);
        }
      }
    } catch (error) {
      console.debug(`Failed to fetch reviews for card ${cardId}:`, error);
      lastReviewed = 'Unavailable';
    }

    const nextExpectedReview = this._formatNextExpectedReview(cardInfo, latestReviewMs, isNewCard);

    return {
      cardId,
      deckName,
      fieldLabel,
      fieldValue,
      retrievability,
      stability,
      lastReviewed,
      nextExpectedReview
    };
  }

  private _extractPreferredField(
    cardInfo: { fields?: Record<string, { value: string }> } | undefined
  ): { name: string; value: string } | undefined {
    const fields = cardInfo?.fields;
    if (!fields) {
      return undefined;
    }

    // Prefer user-configured word fields first.
    for (const fieldName of this.options.wordFields) {
      const rawValue = fields[fieldName]?.value;
      const normalizedValue = this._normalizeFieldValue(rawValue || '');
      if (normalizedValue) {
        return { name: fieldName, value: normalizedValue };
      }
    }

    // Fallback to first non-empty field.
    for (const [name, entry] of Object.entries(fields)) {
      const normalizedValue = this._normalizeFieldValue(entry?.value || '');
      if (normalizedValue) {
        return { name, value: normalizedValue };
      }
    }

    return undefined;
  }

  private _formatRetrievabilityText(
    exactRetrievability: number | undefined,
    isNewCard: boolean
  ): string {
    if (isNewCard) {
      return 'New card (not reviewed yet)';
    }

    const bucket = this._retrievabilityBucketText(exactRetrievability);
    if (typeof exactRetrievability === 'number') {
      return `${(exactRetrievability * 100).toFixed(2)}% (${bucket})`;
    }

    return bucket;
  }

  private _retrievabilityBucketText(exactRetrievability: number | undefined): string {
    const retention = Math.round(this.getDesiredRetention() * 100);
    if (typeof exactRetrievability !== 'number') {
      return 'Unknown';
    }

    if (exactRetrievability >= this.getDesiredRetention()) {
      return `>= ${retention}%`;
    }

    return `< ${retention}%`;
  }

  private _formatStabilityText(
    exactStability: number | undefined,
    interval: number | undefined
  ): string {
    if (typeof exactStability === 'number') {
      return `${exactStability.toFixed(2)} days`;
    }

    if (typeof interval === 'number') {
      return `${interval} day${interval === 1 ? '' : 's'} (interval)`;
    }

    return 'Unavailable';
  }

  private _formatNextExpectedReview(
    cardInfo: Pick<CardInfo, 'due' | 'queue' | 'type' | 'interval'> | undefined,
    latestReviewMs: number | undefined,
    isNewCard: boolean
  ): string {
    if (isNewCard) {
      return 'After first review';
    }

    const queue = cardInfo?.queue;
    if (queue === -1) {
      return 'Suspended';
    }
    if (queue === -2 || queue === -3) {
      return 'Buried';
    }

    const dueDate = this._dueValueToDate(cardInfo?.due, queue, cardInfo?.type);
    if (dueDate) {
      return this._formatTimestampMs(dueDate.getTime());
    }

    if (
      typeof latestReviewMs === 'number' &&
      typeof cardInfo?.interval === 'number' &&
      Number.isFinite(cardInfo.interval) &&
      cardInfo.interval > 0
    ) {
      return this._formatTimestampMs(latestReviewMs + cardInfo.interval * 24 * 60 * 60 * 1000);
    }

    return 'Unavailable';
  }

  private _dueValueToDate(
    dueValue: number | undefined,
    queue: number | undefined,
    cardType: number | undefined
  ): Date | undefined {
    if (typeof dueValue !== 'number' || !Number.isFinite(dueValue) || dueValue <= 0) {
      return undefined;
    }

    // Learning/relearning cards usually store due as unix seconds.
    if (queue === 1 || cardType === 1) {
      if (dueValue > 1_000_000_000) {
        return new Date(dueValue * 1000);
      }
      return undefined;
    }

    // Review/day-learning cards often store due as day index since unix epoch.
    if (queue === 2 || cardType === 2 || queue === 3 || cardType === 3) {
      if (dueValue > 1_000 && dueValue < 1_000_000) {
        return new Date(dueValue * 24 * 60 * 60 * 1000);
      }
      if (dueValue > 1_000_000_000) {
        return new Date(dueValue * 1000);
      }
      return undefined;
    }

    // Generic fallback heuristics.
    if (dueValue > 1_000_000_000) {
      return new Date(dueValue * 1000);
    }
    if (dueValue > 1_000 && dueValue < 1_000_000) {
      return new Date(dueValue * 24 * 60 * 60 * 1000);
    }

    return undefined;
  }

  private _formatTimestampMs(timestampMs: number): string {
    try {
      return new Date(timestampMs).toLocaleString();
    } catch {
      return `${timestampMs}`;
    }
  }

  private _computeWordDataExpiryFromNextDue(
    cardIds: number[],
    cardScheduleById: Map<number, Pick<CardInfo, 'due' | 'queue' | 'type'>>
  ): number | undefined {
    const now = Date.now();
    let earliestDueAtMs: number | undefined;

    for (const cardId of cardIds) {
      const schedule = cardScheduleById.get(cardId);
      if (!schedule) {
        continue;
      }

      const dueDate = this._dueValueToDate(schedule.due, schedule.queue, schedule.type);
      if (!dueDate) {
        continue;
      }

      const dueAtMs = dueDate.getTime();
      if (!Number.isFinite(dueAtMs)) {
        continue;
      }

      if (earliestDueAtMs === undefined || dueAtMs < earliestDueAtMs) {
        earliestDueAtMs = dueAtMs;
      }
    }

    if (earliestDueAtMs === undefined) {
      return undefined;
    }

    // Avoid immediate expiry loops for currently due cards.
    const MIN_EXPIRY_MS = 5 * 60 * 1000;
    return Math.max(now + MIN_EXPIRY_MS, earliestDueAtMs);
  }

  private async _gradeToken(token: string, span: HTMLElement): Promise<void> {
    try {
      const existingData = await this._resolveTokenWordData(token, SHARED_TOKEN_RESOLUTION_OPTIONS);

      if (!existingData || existingData.cardIds.length === 0) {
        await this._showNoticeDialog(
          'No Card Found',
          `No mapped Anki card was found for "${token}".`,
          'This token cannot be graded yet.'
        );
        return;
      }

      const cardId = existingData.cardIds[0];

      if (!cardId) {
        await this._showNoticeDialog(
          'No Card Found',
          `No gradeable card ID was found for "${token}".`,
          'This token cannot be graded yet.'
        );
        return;
      }

      const dialogInfo = await this._buildGradeDialogInfo(cardId, existingData.status);
      const dialogAction = await this._showGradeDialog(token, dialogInfo);
      if (dialogAction.type === 'cancel') {
        return;
      }

      if (dialogAction.type === 'open-browser') {
        await this.anki.guiBrowse(`cid:${cardId}`);
        return;
      }

      const ease = dialogAction.ease;

      // Preferred path: custom AnkiConnect action exposed by your fork.
      try {
        const graded = await this.anki.gradeNow([cardId], ease);
        if (graded) {
          this.lastRefreshTime.delete(token);
          await this._refreshToken(token, span);
          return;
        }

        window.alert('Failed to submit grade via gradeNow.');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : `${error}`;
        const unsupportedGradeNow = /unsupported action/i.test(errorMessage);

        if (!unsupportedGradeNow) {
          throw error;
        }
      }

      // Fallback path for stock AnkiConnect (can only answer current reviewer card).
      const currentCard = await this.anki.guiCurrentCard();
      if (!currentCard) {
        window.alert('No active reviewer card in Anki.');
        return;
      }

      if (!existingData.cardIds.includes(currentCard.cardId)) {
        await this.anki.guiBrowse(`cid:${cardId}`);
        window.alert(
          `Opened cid:${cardId} in Anki Browser.\nYour AnkiConnect does not expose gradeNow, so direct grading works only for the current reviewer card.`
        );
        return;
      }

      await this.anki.guiShowAnswer();
      const answered = await this.anki.guiAnswerCard(ease);
      if (!answered) {
        window.alert('Failed to submit grade to Anki.');
        return;
      }

      this.lastRefreshTime.delete(token);
      await this._refreshToken(token, span);
    } catch (error) {
      console.error(`❌ Failed grading token "${token}":`, error);
      window.alert('Failed to grade token in Anki. See console for details.');
    }
  }

  private _resolveTokenColorFromWordData(wordData: CachedWordData | undefined): TokenColor {
    if (!wordData || !Array.isArray(wordData.cardIds) || wordData.cardIds.length === 0) {
      return TokenColor.UNCOLLECTED;
    }

    return this._statusToColor(wordData.status);
  }

  private _applyColorToTokenSpan(span: HTMLElement, color: TokenColor): void {
    const style = this.options.tokenStyle;
    const whiteSpaceStyle = 'white-space: pre-wrap;';

    if (style === TokenStyle.TEXT) {
      span.style.cssText = `color: ${color}; ${whiteSpaceStyle}`;
      return;
    }

    const decoration = color === TokenColor.ERROR ? 'double' : 'solid';
    span.style.cssText = `text-decoration: underline ${color} ${decoration}; ${whiteSpaceStyle}`;
  }

  private async _refreshTokenWordDataFromAnki(token: string): Promise<void> {
    const existingData = await this._resolveTokenWordData(token, SHARED_TOKEN_RESOLUTION_OPTIONS);

    if (!existingData || existingData.cardIds.length === 0) {
      console.log(`🔄 Token "${token}" has no cached wordData card IDs, performing full refresh`);
      const fetchedWordData = await this._fetchWordDataFromAnki(token);
      const wordData: CachedWordData = fetchedWordData || {
        status: 'unknown',
        analysisStatus: 'uncollected',
        due: false,
        cardIds: []
      };

      if (this.cacheService) {
        await this.cacheService.setWordData(token, wordData);
        console.log(`💾 Updated cache for "${token}": ${wordData.status}`);
      }

      return;
    }

    const dedupedCardIds = Array.from(
      new Set((existingData.cardIds || []).filter((cardId) => Number.isFinite(cardId)))
    );

    if (dedupedCardIds.length === 0) {
      return;
    }

    console.log(`⚡ Fast refresh for "${token}" using ${dedupedCardIds.length} cached card IDs`);

    const metricsMap = await this.anki.cardMetricsMap(dedupedCardIds, ['prop:r', 'prop:s']);
    const newCardIds = await this._resolveNewCardIdsFromMetrics(dedupedCardIds, metricsMap);
    const statusMap = new Map(
      dedupedCardIds.map((cardId) => [
        cardId,
        this._classifyCardMetrics(metricsMap.get(cardId), newCardIds.has(cardId))
      ])
    );
    const documentStatusMap = new Map(
      dedupedCardIds.map((cardId) => [
        cardId,
        this._classifyLearningStatus(metricsMap.get(cardId), newCardIds.has(cardId))
      ])
    );

    let wordData: CachedWordData = {
      status: this._pickBestStatus(dedupedCardIds, statusMap),
      analysisStatus: this._pickBestDocumentStatus(dedupedCardIds, documentStatusMap),
      due: dedupedCardIds.some((cardId) =>
        this._isCardDue(metricsMap.get(cardId), newCardIds.has(cardId))
      ),
      cardIds: dedupedCardIds
    };

    // Cached IDs can be stale or mismatched. Re-fetch by token when refresh from IDs is inconclusive.
    if (wordData.status === 'unknown') {
      console.log(`🔄 Fast refresh inconclusive for "${token}", falling back to token lookup`);
      const refreshedWordData = await this._fetchWordDataFromAnki(token);
      if (refreshedWordData) {
        wordData = refreshedWordData;
      }
    }

    if (this.cacheService) {
      await this.cacheService.setWordData(token, wordData);
      console.log(`💾 Updated cache for "${token}": ${wordData.status}`);
    }
  }

  /**
   * Refresh a single token by fetching fresh data from Anki
   * Rate limited to once per 5 seconds to avoid excessive queries
   * @param token - Token to refresh
   * @param span - HTML span element to update
   */
  private async _refreshToken(token: string, span: HTMLElement): Promise<void> {
    try {
      const trimmedToken = token.trim();
      if (!HAS_LETTER_REGEX.test(trimmedToken)) {
        this._applyColorToTokenSpan(span, TokenColor.UNKNOWN);
        return;
      }

      // Rate limiting: check if token was refreshed recently
      const now = Date.now();
      const lastRefresh = this.lastRefreshTime.get(trimmedToken);

      if (lastRefresh && now - lastRefresh < this.REFRESH_COOLDOWN_MS) {
        console.log(
          `⏱️ Token "${trimmedToken}" was refreshed ${Math.round((now - lastRefresh) / 1000)}s ago, skipping (cooldown: ${this.REFRESH_COOLDOWN_MS / 1000}s)`
        );
        return;
      }

      // Update last refresh timestamp
      this.lastRefreshTime.set(trimmedToken, now);

      // Hover refresh only updates IndexedDB from Anki.
      await this._refreshTokenWordDataFromAnki(trimmedToken);

      // Rendering always uses the same IndexedDB resolver path as initial coloring.
      const resolvedWordData = await this._resolveTokenWordData(
        trimmedToken,
        SHARED_TOKEN_RESOLUTION_OPTIONS
      );
      const color = this._resolveTokenColorFromWordData(resolvedWordData);
      this._applyColorToTokenSpan(span, color);
      const resolvedStatus =
        resolvedWordData && resolvedWordData.cardIds.length > 0
          ? resolvedWordData.status
          : 'uncollected';

      console.log(
        `🔄 Refreshed token on hover: "${trimmedToken}" -> status: ${resolvedStatus}, color: ${color}`
      );
    } catch (error) {
      console.error(`❌ Failed to refresh token "${token}":`, error);
    }
  }

  /**
   * Fetch word data directly from Anki (bypassing all caches)
   * Uses prop:r queries to check retrievability categories
   * @param token - Token to look up
   * @returns Word data or undefined if not found
   */
  private async _fetchWordDataFromAnki(token: string): Promise<CachedWordData | undefined> {
    try {
      const candidateWords = await this._buildTokenCandidateWords(token);

      const allCardIds = new Set<number>();

      for (const candidateWord of candidateWords) {
        // Find cards with this candidate in configured word fields
        const cardIds = await this.anki.findCardsWithWord(candidateWord, this.anki.getWordFields());

        if (cardIds.length > 0) {
          cardIds.forEach((id) => allCardIds.add(id));
        }
      }

      // If no cards found, return undefined
      if (allCardIds.size === 0) {
        return undefined;
      }

      const resolvedCardIds = Array.from(allCardIds);
      const statusMap = await this._batchCheckCardRetrievability(resolvedCardIds);
      const metricsMap = await this.anki.cardMetricsMap(resolvedCardIds, ['prop:r', 'prop:s']);
      const newCardIds = await this._resolveNewCardIdsFromMetrics(resolvedCardIds, metricsMap);
      const documentStatusMap = new Map(
        resolvedCardIds.map((cardId) => [
          cardId,
          this._classifyLearningStatus(metricsMap.get(cardId), newCardIds.has(cardId))
        ])
      );

      return {
        status: this._pickBestStatus(resolvedCardIds, statusMap),
        analysisStatus: this._pickBestDocumentStatus(resolvedCardIds, documentStatusMap),
        due: resolvedCardIds.some((cardId) =>
          this._isCardDue(metricsMap.get(cardId), newCardIds.has(cardId))
        ),
        cardIds: resolvedCardIds
      };
    } catch (error) {
      console.error(`Error fetching word data from Anki for "${token}":`, error);
      return undefined;
    }
  }

  private async _buildTokenCandidateWords(
    token: string,
    options?: { allowTermEntriesEnrichment?: boolean }
  ): Promise<string[]> {
    const lemmaData = await this._getOrFetchLemmas(token, options);
    return Array.from(
      new Set(
        [token, ...this._selectLemmaCandidatesForToken(token, lemmaData)]
          .map((word) => word.trim())
          .filter((word) => word.length > 0)
      )
    );
  }

  /**
   * Check retrievability category for a single card using Anki search queries
   * @param cardId - Card ID to check
   * @returns Card status: 'mature', 'young', 'new', 'due', or 'unknown'
   */
  private async _checkCardRetrievability(cardId: number): Promise<WordStatus> {
    try {
      const metrics = await this.anki.cardMetricsMap([cardId], ['prop:r', 'prop:s']);
      const isNewCard = (await this._resolveNewCardIdsFromMetrics([cardId], metrics)).has(cardId);
      return this._classifyCardMetrics(metrics.get(cardId), isNewCard);
    } catch (error) {
      console.error(`Error checking card retrievability for card ${cardId}:`, error);
      return 'unknown';
    }
  }

  /**
   * Batch check retrievability category for multiple cards
   * @param cardIds - Array of card IDs to check
   * @returns Map of card ID -> status
   */
  private async _batchCheckCardRetrievability(cardIds: number[]): Promise<Map<number, WordStatus>> {
    const result = new Map<number, WordStatus>();
    const uniqueCardIds = Array.from(new Set(cardIds.filter((id) => Number.isFinite(id))));
    if (uniqueCardIds.length === 0) return result;

    try {
      const metricsMap = await this.anki.cardMetricsMap(uniqueCardIds, ['prop:r', 'prop:s']);
      if (metricsMap.size > 0) {
        const newCardIds = await this._resolveNewCardIdsFromMetrics(uniqueCardIds, metricsMap);

        for (const cardId of uniqueCardIds) {
          result.set(
            cardId,
            this._classifyCardMetrics(metricsMap.get(cardId), newCardIds.has(cardId))
          );
        }

        return result;
      }
    } catch {
      // Fallback to per-card checks below when metric fields are not supported.
    }

    try {
      for (const cardId of uniqueCardIds) {
        result.set(cardId, await this._checkCardRetrievability(cardId));
      }

      return result;
    } catch (error) {
      console.error('Error batch checking card retrievability:', error);
      return result;
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
          tokenColorMap.set(trimmedToken, TokenColor.UNKNOWN);
          continue;
        }

        // Skip if already processed
        if (tokenColorMap.has(trimmedToken)) continue;

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
        const color = tokenColorMap.get(trimmedToken) || TokenColor.UNKNOWN;
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
    // IndexedDB is the source of truth.
    if (this.cacheService) {
      const tokens = await this.cacheService.getTokens(text);
      if (tokens) return tokens;
    }

    // Fetch from Yomitan API
    const tokens = await this.yomitan.tokenize(text);

    // Persist to cache
    if (this.cacheService) {
      await this.cacheService.setTokens(text, tokens);
    }

    return tokens;
  }

  private async _getOrFetchLemmas(
    token: string,
    options?: { allowTermEntriesEnrichment?: boolean }
  ): Promise<CachedLemmas> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return { lemmas: [], lemmaReadings: [] };
    }

    const allowTermEntriesEnrichment = options?.allowTermEntriesEnrichment ?? true;

    // IndexedDB is the source of truth, but weak cached lemmas are enriched.
    if (this.cacheService) {
      const cachedLemmas = await this.cacheService.getLemmas(normalizedToken);
      if (
        cachedLemmas &&
        (cachedLemmas.lemmas.length > 0 || cachedLemmas.lemmaReadings.length > 0)
      ) {
        return cachedLemmas;
      }
    }

    if (!allowTermEntriesEnrichment) {
      return { lemmas: [], lemmaReadings: [] };
    }

    // Fetch from Yomitan API
    const lemmas = await this.yomitan.lemmatize(normalizedToken);
    if (this.cacheService) {
      await this.cacheService.setLemmas(normalizedToken, lemmas);
    }

    return lemmas;
  }

  private _mergeUniqueLemmas(existing: string[], incoming: string[]): string[] {
    const merged = new Set<string>();
    for (const lemma of [...existing, ...incoming]) {
      const normalizedLemma = lemma.trim();
      if (normalizedLemma) {
        merged.add(normalizedLemma);
      }
    }

    return Array.from(merged);
  }

  private _selectLemmaCandidatesForToken(token: string, lemmaData: CachedLemmas): string[] {
    const normalizedToken = token.trim();
    const hasKanji = HAS_KANJI_REGEX.test(normalizedToken);
    const isReadingToken = !hasKanji && HAS_KANA_REGEX.test(normalizedToken);

    const baseLemmas = hasKanji
      ? lemmaData.lemmas.filter((lemma) => HAS_KANJI_REGEX.test(lemma))
      : lemmaData.lemmas;
    const lemmaCandidates = this._expandLemmaLookupCandidates(baseLemmas);

    if (!isReadingToken) {
      return lemmaCandidates;
    }

    const readingCandidates = this._expandLemmaLookupCandidates(lemmaData.lemmaReadings);
    return this._mergeUniqueLemmas(lemmaCandidates, readingCandidates);
  }

  /**
   * Get word data for a token, using IndexedDB as the source of truth.
   * @param word - Word to lookup
   * @returns Word data if found, undefined otherwise
   */
  private async _getWordData(word: string): Promise<CachedWordData | undefined> {
    const candidates = this._buildWordLookupCandidates(word);

    // IndexedDB is the source of truth.
    if (this.cacheService) {
      for (const candidate of candidates) {
        let wordData = await this.cacheService.getWordData(candidate);
        if (!wordData) {
          continue;
        }

        if (!Array.isArray(wordData.cardIds)) {
          wordData = { ...wordData, cardIds: [] };
        }

        return wordData;
      }
    }

    return undefined;
  }

  private _normalizeResolvedWordData(
    wordData: CachedWordData | undefined
  ): CachedWordData | undefined {
    if (!wordData || !Array.isArray(wordData.cardIds)) {
      return undefined;
    }

    const cardIds = Array.from(
      new Set(
        (wordData.cardIds || [])
          .map((cardId) => {
            if (typeof cardId === 'number') {
              return cardId;
            }

            if (typeof cardId === 'string') {
              const parsed = Number.parseInt(cardId, 10);
              return Number.isFinite(parsed) ? parsed : Number.NaN;
            }

            return Number.NaN;
          })
          .filter((cardId) => Number.isFinite(cardId))
      )
    );
    if (!cardIds.length) {
      return undefined;
    }

    return {
      status: wordData.status,
      analysisStatus: wordData.analysisStatus,
      due: wordData.due,
      cardIds
    };
  }

  private _pickBetterResolvedWordData(
    current: CachedWordData | undefined,
    candidate: CachedWordData | undefined
  ): CachedWordData | undefined {
    const normalizedCandidate = this._normalizeResolvedWordData(candidate);
    if (!normalizedCandidate) {
      return current;
    }

    const normalizedCurrent = this._normalizeResolvedWordData(current);
    if (!normalizedCurrent) {
      return normalizedCandidate;
    }

    const currentPriority = this._statusPriority(normalizedCurrent.status);
    const candidatePriority = this._statusPriority(normalizedCandidate.status);
    if (candidatePriority > currentPriority) {
      return normalizedCandidate;
    }
    if (candidatePriority < currentPriority) {
      return normalizedCurrent;
    }

    const currentHasAnalysis =
      normalizedCurrent.analysisStatus !== undefined && normalizedCurrent.due !== undefined;
    const candidateHasAnalysis =
      normalizedCandidate.analysisStatus !== undefined && normalizedCandidate.due !== undefined;

    if (candidateHasAnalysis && !currentHasAnalysis) {
      return normalizedCandidate;
    }

    return normalizedCurrent;
  }

  private async _resolveTokenWordData(
    token: string,
    options?: { allowTermEntriesEnrichment?: boolean }
  ): Promise<CachedWordData | undefined> {
    let resolvedWordData = this._pickBetterResolvedWordData(
      undefined,
      await this._getWordData(token)
    );
    if (resolvedWordData && resolvedWordData.status === 'mature') {
      return resolvedWordData;
    }

    const allowTermEntriesEnrichment = options?.allowTermEntriesEnrichment ?? true;
    // If a direct token match already exists, only use cached lemmas to avoid unnecessary
    // termEntries calls; still allow lemma candidates to upgrade status (e.g. young -> mature).
    const lemmaData = await this._getOrFetchLemmas(token, {
      allowTermEntriesEnrichment: resolvedWordData ? false : allowTermEntriesEnrichment
    });
    const lemmaCandidates = this._selectLemmaCandidatesForToken(token, lemmaData);
    let finalLemmas = lemmaCandidates;
    let finalLemmaCandidates = lemmaCandidates;
    for (const lemmaCandidate of lemmaCandidates) {
      resolvedWordData = this._pickBetterResolvedWordData(
        resolvedWordData,
        await this._getWordData(lemmaCandidate)
      );
      if (resolvedWordData && resolvedWordData.status === 'mature') {
        break;
      }
    }

    // If cached lemmas did not resolve to any wordData row, enrich once via termEntries
    // and retry lookup with merged lemmas.
    if (!resolvedWordData && allowTermEntriesEnrichment) {
      const enrichedLemmas = await this.yomitan.lemmatize(token);
      const mergedLemmaData: CachedLemmas = {
        lemmas: this._mergeUniqueLemmas(lemmaData.lemmas, enrichedLemmas.lemmas),
        lemmaReadings: this._mergeUniqueLemmas(
          lemmaData.lemmaReadings,
          enrichedLemmas.lemmaReadings
        )
      };
      finalLemmas = this._selectLemmaCandidatesForToken(token, mergedLemmaData);

      if (
        (mergedLemmaData.lemmas.length > 0 || mergedLemmaData.lemmaReadings.length > 0) &&
        this.cacheService
      ) {
        await this.cacheService.setLemmas(token, mergedLemmaData);
      }

      const mergedCandidates = finalLemmas;
      finalLemmaCandidates = mergedCandidates;
      for (const lemmaCandidate of mergedCandidates) {
        resolvedWordData = this._pickBetterResolvedWordData(
          resolvedWordData,
          await this._getWordData(lemmaCandidate)
        );
        if (resolvedWordData && resolvedWordData.status === 'mature') {
          break;
        }
      }
    }

    if (!resolvedWordData && finalLemmas.length > 0) {
      this._logLemmaWordDataMiss(token, finalLemmas, finalLemmaCandidates);
    }

    if (resolvedWordData && this.cacheService) {
      // Persist token-level alias so token lookups don't depend on resolving through lemmas each time.
      await this.cacheService.setWordData(token, resolvedWordData);
    }

    return resolvedWordData;
  }

  private _logLemmaWordDataMiss(token: string, lemmas: string[], candidates: string[]): void {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return;
    }

    const now = Date.now();
    const lastLog = this.lemmaWordDataMissLogTime.get(normalizedToken) || 0;
    if (now - lastLog < this.LEMMA_WORDDATA_MISS_LOG_COOLDOWN_MS) {
      return;
    }

    this.lemmaWordDataMissLogTime.set(normalizedToken, now);
    console.warn('[AnkiCache] Lemma mapped token has no matching wordData row', {
      token: normalizedToken,
      lemmas,
      candidates
    });
  }

  private _expandLemmaLookupCandidates(lemmas: string[]): string[] {
    const candidates = new Set<string>();

    const addCandidate = (value: string) => {
      const canonical = this._canonicalizeLookupValue(value);
      if (canonical) {
        candidates.add(canonical);
      }
    };

    for (const lemma of lemmas) {
      const trimmedLemma = lemma.trim();
      if (!trimmedLemma) {
        continue;
      }

      addCandidate(trimmedLemma);

      // Some dictionaries append POS tags to lemmas (e.g. "僕-代名詞").
      // Use the lexical part as an additional lookup candidate.
      const lexicalPart = trimmedLemma.split(/[-‐‑‒–—―]/u)[0]?.trim();
      if (lexicalPart && lexicalPart !== trimmedLemma) {
        addCandidate(lexicalPart);
      }
    }

    return Array.from(candidates);
  }

  private async _resolveTokenWordDataBatch(
    tokens: string[],
    options?: { allowTermEntriesEnrichment?: boolean }
  ): Promise<Map<string, CachedWordData>> {
    const resolved = new Map<string, CachedWordData>();
    const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)));
    if (!uniqueTokens.length) {
      return resolved;
    }

    for (const chunk of this._chunkArray(uniqueTokens, 25)) {
      const chunkResolved = await Promise.all(
        chunk.map(async (token) => {
          try {
            return { token, wordData: await this._resolveTokenWordData(token, options) };
          } catch (error) {
            console.debug('Token word-data resolution failed for token', token, error);
            return { token, wordData: undefined as CachedWordData | undefined };
          }
        })
      );

      for (const { token, wordData } of chunkResolved) {
        const normalizedWordData = this._normalizeResolvedWordData(wordData);
        if (normalizedWordData) {
          resolved.set(token, normalizedWordData);
        }
      }
    }

    return resolved;
  }

  private _buildWordLookupCandidates(word: string): string[] {
    const trimmed = word.trim();
    if (!trimmed) {
      return [];
    }

    const candidates = new Set<string>();
    const addCandidate = (value: string) => {
      const canonical = this._canonicalizeLookupValue(value);
      if (canonical) {
        candidates.add(canonical);
      }
    };

    addCandidate(trimmed);
    addCandidate(this._normalizeFieldValue(trimmed));

    const edgeStripped = trimmed.replace(/^[^\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+$/gu, '');
    if (edgeStripped && edgeStripped !== trimmed) {
      addCandidate(edgeStripped);
      addCandidate(this._normalizeFieldValue(edgeStripped));
    }

    return Array.from(candidates);
  }

  /**
   * Batch fetch token colors for multiple uncached tokens
   * Reads word data from IndexedDB and only falls back to live queries when needed.
   * @param tokens - Array of uncached tokens
   * @param colorMap - Map to populate with token -> color mappings
   */
  private async _batchFetchTokenColors(
    tokens: string[],
    colorMap: Map<string, TokenColor>
  ): Promise<void> {
    const resolvedWordDataByToken = await this._resolveTokenWordDataBatch(
      tokens,
      SHARED_TOKEN_RESOLUTION_OPTIONS
    );

    for (const token of tokens) {
      const wordData = resolvedWordDataByToken.get(token);
      colorMap.set(token, this._resolveTokenColorFromWordData(wordData));
    }
  }

  private _statusToColor(status: WordStatus): TokenColor {
    switch (status) {
      case 'mature':
        return this.options.colorMode === TokenColorMode.COMBINED &&
          this.options.colorPalette === TokenColorPalette.SIMPLE
          ? TokenColor.UNKNOWN
          : TokenColor.MATURE;
      case 'young':
        return TokenColor.YOUNG;
      case 'new':
        return TokenColor.NEW;
      case 'due':
        return TokenColor.DUE;
      case 'unknown':
        return TokenColor.UNKNOWN;
      default:
        return TokenColor.UNKNOWN;
    }
  }

  private _classifyCardMetrics(
    metric:
      | {
          'prop:r'?: number | null;
          'prop:s'?: number | null;
        }
      | undefined,
    isNewCard: boolean
  ): WordStatus {
    if (isNewCard) {
      return 'new';
    }

    const retrievability = metric?.['prop:r'];
    const stability = metric?.['prop:s'];
    const highRetrievability =
      typeof retrievability === 'number' && retrievability >= this.getDesiredRetention();
    const highStability = typeof stability === 'number' && stability >= this.getMatureThreshold();

    switch (this.options.colorMode) {
      case TokenColorMode.STABILITY:
        if (typeof stability !== 'number') {
          return 'unknown';
        }
        return highStability ? 'mature' : 'due';
      case TokenColorMode.RETRIEVABILITY:
        if (typeof retrievability !== 'number') {
          return 'unknown';
        }
        return highRetrievability ? 'mature' : 'due';
      case TokenColorMode.COMBINED:
      default:
        if (typeof stability !== 'number' && typeof retrievability !== 'number') {
          return 'unknown';
        }

        if (highStability && highRetrievability) {
          return 'mature';
        }
        if (!highStability && !highRetrievability) {
          return 'due';
        }
        return 'young';
    }
  }

  private _classifyLearningStatus(
    metric:
      | {
          'prop:r'?: number | null;
          'prop:s'?: number | null;
        }
      | undefined,
    isNewCard: boolean
  ): DocumentTokenStatus {
    if (isNewCard) {
      return 'new';
    }

    const stability = metric?.['prop:s'];
    if (typeof stability !== 'number') {
      return 'unknown';
    }

    return stability >= this.getMatureThreshold() ? 'mature' : 'young';
  }

  private _inferIsNewFromMetrics(
    metric:
      | {
          'prop:r'?: number | null;
          'prop:s'?: number | null;
        }
      | undefined
  ): boolean | undefined {
    if (!metric) {
      return undefined;
    }

    const retrievability = metric['prop:r'];
    if (typeof retrievability === 'number') {
      return false;
    }
    if (retrievability === null) {
      return true;
    }

    const stability = metric['prop:s'];
    if (typeof stability === 'number') {
      return false;
    }
    if (stability === null) {
      return true;
    }

    return undefined;
  }

  private async _resolveNewCardIdsFromMetrics(
    cardIds: number[],
    metricsMap: Map<number, { 'prop:r'?: number | null; 'prop:s'?: number | null }>
  ): Promise<Set<number>> {
    const newCardIds = new Set<number>();

    for (const cardId of cardIds) {
      const inferred = this._inferIsNewFromMetrics(metricsMap.get(cardId));
      if (inferred === true) {
        newCardIds.add(cardId);
      }
    }

    return newCardIds;
  }

  private _inferIsNewFromCardInfo(card: CardInfo): boolean | undefined {
    if (typeof card.reps === 'number') {
      return card.reps <= 0;
    }

    if (typeof card.queue === 'number') {
      if (card.queue === 0) {
        return true;
      }
      if ([1, 2, 3, -1, -2, -3].includes(card.queue)) {
        return false;
      }
    }

    if (typeof card.type === 'number') {
      if (card.type === 0) {
        return true;
      }
      if ([1, 2, 3].includes(card.type)) {
        return false;
      }
    }

    return this._inferIsNewFromMetrics({
      'prop:r': card['prop:r'],
      'prop:s': card['prop:s']
    });
  }

  private _isCardDue(
    metric:
      | {
          'prop:r'?: number | null;
        }
      | undefined,
    isNewCard: boolean
  ): boolean {
    if (isNewCard) {
      return false;
    }

    return typeof metric?.['prop:r'] === 'number' && metric['prop:r'] < this.getDesiredRetention();
  }

  private _documentStatusPriority(status: DocumentTokenStatus): number {
    switch (status) {
      case 'mature':
        return 4;
      case 'young':
        return 3;
      case 'new':
        return 2;
      case 'unknown':
        return 1;
      default:
        return 0;
    }
  }

  private _pickBestStatus(cardIds: number[], statuses: Map<number, WordStatus>): WordStatus {
    let bestStatus: WordStatus = 'unknown';

    for (const cardId of cardIds) {
      const status = statuses.get(cardId) || 'unknown';
      if (this._statusPriority(status) > this._statusPriority(bestStatus)) {
        bestStatus = status;
        if (bestStatus === 'mature') {
          break;
        }
      }
    }

    return bestStatus;
  }

  private _pickBestDocumentStatus(
    cardIds: number[],
    statuses: Map<number, DocumentTokenStatus>
  ): DocumentTokenStatus {
    let bestStatus: DocumentTokenStatus = 'unknown';

    for (const cardId of cardIds) {
      const status = statuses.get(cardId) || 'unknown';
      if (this._documentStatusPriority(status) > this._documentStatusPriority(bestStatus)) {
        bestStatus = status;
        if (bestStatus === 'mature') {
          break;
        }
      }
    }

    return bestStatus;
  }

  private _statusPriority(status: WordStatus): number {
    switch (status) {
      case 'mature':
        return 5;
      case 'young':
        return 4;
      case 'new':
        return 3;
      case 'due':
        return 2;
      case 'unknown':
        return 1;
      default:
        return 0;
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
      style = TokenStyle.TEXT;
    }

    // Preserve whitespace in the styled spans to maintain formatting
    const whiteSpaceStyle = 'white-space: pre-wrap;';

    // Add data attribute with token for hover refresh functionality
    const tokenData = `data-anki-token="${this._escapeHtml(token.trim())}"`;

    switch (style) {
      case TokenStyle.TEXT:
        return `<span ${tokenData} style="color: ${color}; ${whiteSpaceStyle}">${token}</span>`;
      case TokenStyle.UNDERLINE: {
        const decoration = color === TokenColor.ERROR ? 'double' : 'solid';
        // Use simple underline to avoid confusion with ruby/furigana boundaries
        return `<span ${tokenData} style="text-decoration: underline ${color} ${decoration}; ${whiteSpaceStyle}">${token}</span>`;
      }
      default:
        return token;
    }
  }

  /**
   * Escape HTML special characters
   * @param text - Text to escape
   * @returns Escaped text
   */
  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  private _unwrapTokenSpans(element: Element): void {
    const tokenSpans = Array.from(element.querySelectorAll('[data-anki-token]')).reverse();

    for (const tokenSpan of tokenSpans) {
      const parent = tokenSpan.parentNode;

      if (!parent) {
        continue;
      }

      parent.replaceChild(document.createTextNode(tokenSpan.textContent || ''), tokenSpan);
    }
  }

  /**
   * Clear all persistent caches.
   */
  async clearCache(): Promise<void> {
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
      const wordDataCount = await db.count('wordData');
      if (wordDataCount === 0) {
        console.log('📦 No cache found in IndexedDB');
        return { loadedWords: 0, needsRefresh: true, cacheAge: Number.MAX_SAFE_INTEGER };
      }

      const tx = db.transaction('wordData', 'readonly');
      const store = tx.objectStore('wordData');
      const cursor = await store.openCursor();

      // Prefer warm-cache timestamp when present, fallback to an entry timestamp.
      const hasWindow = typeof window !== 'undefined' && !!window.localStorage;
      const storedWarmCacheUpdatedAt = hasWindow
        ? Number.parseInt(window.localStorage.getItem(this.warmCacheUpdatedAtStorageKey) || '', 10)
        : NaN;
      const referenceTimestamp = Number.isFinite(storedWarmCacheUpdatedAt)
        ? storedWarmCacheUpdatedAt
        : cursor?.value?.timestamp;
      const cacheAge = Number.isFinite(referenceTimestamp)
        ? Date.now() - referenceTimestamp
        : Number.MAX_SAFE_INTEGER;
      const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
      const storedWarmCacheVersion = hasWindow
        ? window.localStorage.getItem(this.warmCacheVersionStorageKey)
        : this.warmCacheVersion;
      const versionMismatch = storedWarmCacheVersion !== this.warmCacheVersion;
      const needsRefresh = cacheAge > CACHE_TTL_MS || versionMismatch;

      console.log(
        `📦 Cache exists (age: ${Math.round(cacheAge / 60000)} min, TTL: ${Math.round(CACHE_TTL_MS / 60000)} min, versionMismatch: ${versionMismatch}) - needsRefresh: ${needsRefresh}`
      );

      return { loadedWords: wordDataCount, needsRefresh, cacheAge };
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

    console.log('🔄 Re-colorizing already processed elements with updated cache...');
    console.log('📊 Cache stats: querying IndexedDB for all token status lookups');

    // Find all elements that were already colored
    const coloredElements = Array.from(document.querySelectorAll('[data-anki-colored="true"]'));

    if (coloredElements.length === 0) {
      console.log('🔄 No elements to re-colorize (none have been processed yet)');
      return;
    }

    // Remove the marker and actually re-colorize them
    coloredElements.forEach((element) => {
      element.removeAttribute('data-anki-colored');
      this._unwrapTokenSpans(element);
    });

    console.log(`🔄 Re-colorizing ${coloredElements.length} elements with cached data...`);

    // Re-colorize all these elements in one batch
    await this.colorizeElementsBatch(coloredElements);

    console.log(`✅ Re-colorized ${coloredElements.length} elements successfully`);
  }

  /**
   * Preemptively warm the cache with all cards from configured Anki decks
   * Builds retrievability cache and word caches for faster future lookups
   * This should run in the background after loading cached data
   * @returns Promise with cache warming statistics
   */
  async warmCache(options?: { onProgress?: (progress: WarmCacheProgress) => void }): Promise<{
    totalCards: number;
    cachedWords: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let cachedWords = 0;
    const reportProgress = (progress: WarmCacheProgress) => {
      options?.onProgress?.(progress);
    };

    try {
      console.log('Starting Anki cache warming...');
      const deckNames = this.anki.getWordDecks();
      const wordFields = this.anki.getWordFields();
      console.log('Deck names:', deckNames);
      console.log('Word fields:', wordFields);
      console.log(
        `Retrievability thresholds: >0.9, >0.8, >=${this.getDesiredRetention()}, <${this.getDesiredRetention()}`
      );

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

      // Step 1: Get all cards from configured decks with required metrics.
      console.log(
        '✅ Configuration valid. Step 1: Fetching all cards from decks (with prop:r/s)...'
      );
      const allCards = await this.anki.getAllCardsFromDecks(
        undefined,
        ['prop:r', 'prop:s'],
        (progress: GetAllCardsProgress) => {
          reportProgress({
            phase: 'fetch-cards',
            percentage: Math.min(55, Math.round(progress.percentage * 0.55)),
            completed: progress.completed,
            total: progress.total,
            detail: progress.detail
          });
        }
      );
      console.log(`Got ${allCards.length} cards from getAllCardsFromDecks`);

      if (allCards.length === 0) {
        console.warn('No cards found for cache warming');
        return { totalCards: 0, cachedWords: 0, duration: Date.now() - startTime };
      }

      console.log(`Found ${allCards.length} cards. Populating cache...`);

      // Extract unique words from configured word fields
      const wordToCardIds = new Map<string, number[]>();
      const cardScheduleById = new Map<number, Pick<CardInfo, 'due' | 'queue' | 'type'>>();

      for (const card of allCards) {
        cardScheduleById.set(card.cardId, {
          due: card.due,
          queue: card.queue,
          type: card.type
        });

        for (const field of wordFields) {
          const fieldValue = card.fields[field]?.value;
          if (fieldValue) {
            const lookupCandidates = this._extractWordFieldCandidates(fieldValue);
            for (const candidate of lookupCandidates) {
              const cardIds = wordToCardIds.get(candidate) || [];
              if (!cardIds.includes(card.cardId)) {
                cardIds.push(card.cardId);
                wordToCardIds.set(candidate, cardIds);
              }
            }
          }
        }
      }

      console.log(`Extracted ${wordToCardIds.size} unique words from cards`);

      // Step 2: Reuse metrics returned by cardsInfo and infer "new" state locally.
      console.log('Step 2: Building metrics/new-card map from fetched cards...');
      const metricsByCardId = new Map<
        number,
        { 'prop:r'?: number | null; 'prop:s'?: number | null }
      >();
      const newCardIds = new Set<number>();
      const unresolvedNewCardIds = new Set<number>();
      const missingMetricCardIds = new Set<number>();
      const missingScheduleCardIds = new Set<number>();

      for (const card of allCards) {
        const retrievability = card['prop:r'];
        const stability = card['prop:s'];
        const hasRetrievability = typeof retrievability === 'number' || retrievability === null;
        const hasStability = typeof stability === 'number' || stability === null;

        if (hasRetrievability || hasStability) {
          metricsByCardId.set(card.cardId, {
            'prop:r': hasRetrievability ? retrievability : null,
            'prop:s': hasStability ? stability : null
          });
        } else {
          missingMetricCardIds.add(card.cardId);
        }

        const inferredIsNew = this._inferIsNewFromCardInfo(card);
        if (inferredIsNew === true) {
          newCardIds.add(card.cardId);
        } else if (inferredIsNew === undefined) {
          unresolvedNewCardIds.add(card.cardId);
        }

        if (typeof card.due !== 'number' || !Number.isFinite(card.due)) {
          missingScheduleCardIds.add(card.cardId);
        }
      }

      if (missingMetricCardIds.size > 0) {
        console.log(`Step 2a: Fetching missing metrics for ${missingMetricCardIds.size} cards...`);
        const fetchedMetrics = await this.anki.cardMetricsMap(Array.from(missingMetricCardIds), [
          'prop:r',
          'prop:s'
        ]);
        for (const [cardId, metric] of fetchedMetrics.entries()) {
          metricsByCardId.set(cardId, metric);
        }
      }

      if (unresolvedNewCardIds.size > 0) {
        const resolvedNewCardIds = await this._resolveNewCardIdsFromMetrics(
          Array.from(unresolvedNewCardIds),
          metricsByCardId
        );
        for (const cardId of resolvedNewCardIds) {
          newCardIds.add(cardId);
        }
      }

      if (missingScheduleCardIds.size > 0) {
        console.log(
          `Step 2b: Fetching schedule data (due/queue/type) for ${missingScheduleCardIds.size} cards...`
        );
        const SCHEDULE_CHUNK_SIZE = 250;
        const scheduleCardIdList = Array.from(missingScheduleCardIds);
        for (let index = 0; index < scheduleCardIdList.length; index += SCHEDULE_CHUNK_SIZE) {
          const chunk = scheduleCardIdList.slice(index, index + SCHEDULE_CHUNK_SIZE);
          const scheduleMap = await this.anki.cardScheduleMap(chunk);
          for (const scheduleCard of scheduleMap.values()) {
            cardScheduleById.set(scheduleCard.cardId, {
              due: scheduleCard.due,
              queue: scheduleCard.queue,
              type: scheduleCard.type
            });
          }
        }
      }

      console.log(
        `Prepared metrics for ${metricsByCardId.size} cards and inferred ${newCardIds.size} new cards`
      );

      // Step 3: Build single cache: word -> {status, cardIds}
      console.log('Step 3: Mapping words to status...');
      let matureCount = 0,
        youngCount = 0,
        newCount = 0,
        dueCount = 0,
        unknownCount = 0;
      const CACHE_WRITE_BATCH_SIZE = 250;
      const wordEntries = Array.from(wordToCardIds.entries());
      const wordEntryBatches = this._chunkArray(wordEntries, CACHE_WRITE_BATCH_SIZE);
      reportProgress({
        phase: 'process-words',
        percentage: 55,
        completed: 0,
        total: wordEntryBatches.length,
        detail: `Processing 0/${wordEntryBatches.length} batches`
      });

      for (let batchIndex = 0; batchIndex < wordEntryBatches.length; batchIndex++) {
        const batch = wordEntryBatches[batchIndex];
        const wordDataBatch: Array<{ word: string; data: CachedWordData }> = [];

        for (const [word, cardIds] of batch) {
          const documentStatusMap = new Map(
            cardIds.map((cardId) => [
              cardId,
              this._classifyLearningStatus(metricsByCardId.get(cardId), newCardIds.has(cardId))
            ])
          );
          const status = this._pickBestStatus(
            cardIds,
            new Map(
              cardIds.map((cardId) => [
                cardId,
                this._classifyCardMetrics(metricsByCardId.get(cardId), newCardIds.has(cardId))
              ])
            )
          );

          // Count by status
          if (status === 'mature') matureCount++;
          else if (status === 'young') youngCount++;
          else if (status === 'new') newCount++;
          else if (status === 'due') dueCount++;
          else unknownCount++;

          const wordData: CachedWordData = {
            status,
            analysisStatus: this._pickBestDocumentStatus(cardIds, documentStatusMap),
            due: cardIds.some((cardId) =>
              this._isCardDue(metricsByCardId.get(cardId), newCardIds.has(cardId))
            ),
            cardIds,
            expiresAtMs: this._computeWordDataExpiryFromNextDue(cardIds, cardScheduleById)
          };

          wordDataBatch.push({ word, data: wordData });
          cachedWords++;
        }

        if (this.cacheService) {
          await this.cacheService.setWordDataBatch(wordDataBatch);
        }

        const completedBatches = batchIndex + 1;
        reportProgress({
          phase: 'process-words',
          percentage:
            55 + Math.round((completedBatches / Math.max(1, wordEntryBatches.length)) * 45),
          completed: completedBatches,
          total: wordEntryBatches.length,
          detail: `Processing ${completedBatches}/${wordEntryBatches.length} batches`
        });

        // Yield between chunks so main thread remains responsive.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      console.log(
        `Words by status: ${matureCount} mature, ${youngCount} young, ${newCount} new, ${dueCount} due, ${unknownCount} unknown`
      );

      console.log('🔄 Cache warmed in IndexedDB; future lookups read directly from IndexedDB');

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.warmCacheVersionStorageKey, this.warmCacheVersion);
        window.localStorage.setItem(this.warmCacheUpdatedAtStorageKey, `${Date.now()}`);
      }

      const duration = Date.now() - startTime;
      console.log(`Cache warming complete: ${cachedWords} words cached in ${duration}ms`);
      reportProgress({
        phase: 'process-words',
        percentage: 100,
        completed: wordEntryBatches.length,
        total: wordEntryBatches.length,
        detail: `Processed ${wordEntryBatches.length}/${wordEntryBatches.length} batches`
      });

      return { totalCards: allCards.length, cachedWords, duration };
    } catch (error) {
      console.error('Error during cache warming:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      const duration = Date.now() - startTime;
      return { totalCards: 0, cachedWords, duration };
    }
  }

  private _normalizeFieldValue(value: string): string {
    return this._canonicalizeLookupValue(
      value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  private _extractWordFieldCandidates(fieldValue: string): string[] {
    const candidates = new Set<string>();

    const addCandidate = (value: string) => {
      const canonical = this._canonicalizeLookupValue(value);
      if (canonical) {
        candidates.add(canonical);
      }
    };

    const rawWord = fieldValue.trim();
    if (rawWord) {
      addCandidate(rawWord);
    }

    const normalizedWord = this._normalizeFieldValue(fieldValue);
    if (normalizedWord) {
      addCandidate(normalizedWord);
    }

    // For HTML-rich word fields (e.g. ruby markup), derive explicit plain-text variants.
    if (fieldValue.includes('<') && typeof document !== 'undefined') {
      const template = document.createElement('template');
      template.innerHTML = fieldValue;
      template.content.querySelectorAll('rt, rp').forEach((node) => node.remove());
      const plainText = (template.content.textContent || '').trim();

      if (plainText) {
        const compactPlainText = plainText.replace(/\s+/g, '');
        addCandidate(plainText);
        addCandidate(compactPlainText);
      }
    }

    // Add de-annotated variants (e.g. 歌う【うたう】 -> 歌う).
    const annotationStrippedVariants = Array.from(candidates).map((candidate) =>
      candidate.replace(/[（(【[][^）)】\]]*[）)】\]]/g, '').trim()
    );
    for (const variant of annotationStrippedVariants) {
      if (!variant) {
        continue;
      }
      addCandidate(variant);
      addCandidate(variant.replace(/\s+/g, ''));
    }

    // Add segment variants for multi-entry fields (comma/slash separated).
    const segmentedVariants = Array.from(candidates).flatMap((candidate) =>
      candidate
        .split(/[、,;/／・|]/g)
        .map((segment) => segment.trim())
        .filter(Boolean)
    );
    for (const segment of segmentedVariants) {
      addCandidate(segment);
      addCandidate(segment.replace(/\s+/g, ''));
    }

    return Array.from(candidates);
  }

  private _canonicalizeLookupValue(value: string): string {
    return value
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  private _normalizeDesiredRetention(desiredRetention: number): number {
    if (!Number.isFinite(desiredRetention)) {
      return 0.6;
    }

    const normalized = desiredRetention > 1 ? desiredRetention / 100 : desiredRetention;
    return Math.min(1, Math.max(0, normalized));
  }

  private _normalizeMatureThreshold(matureThreshold: number): number {
    if (!Number.isFinite(matureThreshold)) {
      return 21;
    }

    return Math.max(0, matureThreshold);
  }

  private _throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
  }

  private _chunkDocumentText(text: string, chunkSize: number): string[] {
    if (!text) {
      return [];
    }

    const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));
    const chunks: string[] = [];

    for (let index = 0; index < text.length; index += normalizedChunkSize) {
      chunks.push(text.slice(index, index + normalizedChunkSize));
    }

    return chunks;
  }

  private _chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (items.length === 0) {
      return [];
    }

    const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += normalizedChunkSize) {
      chunks.push(items.slice(index, index + normalizedChunkSize));
    }

    return chunks;
  }

  private async _resolveTokenAnalysisData(
    tokens: string[]
  ): Promise<Map<string, { status: DocumentTokenStatus; due: boolean; cardIds: number[] }>> {
    const resolved = new Map<
      string,
      { status: DocumentTokenStatus; due: boolean; cardIds: number[] }
    >();

    const tokenWordData = await this._resolveTokenWordDataBatch(
      tokens,
      SHARED_TOKEN_RESOLUTION_OPTIONS
    );
    const tokenToCardIds = new Map<string, number[]>();
    const allCardIds = new Set<number>();

    for (const token of tokens) {
      const wordData = tokenWordData.get(token);
      if (!wordData || !wordData.cardIds.length) {
        resolved.set(token, { status: 'uncollected', due: false, cardIds: [] });
        continue;
      }

      const cardIds = wordData.cardIds;
      if (wordData.analysisStatus !== undefined && wordData.due !== undefined) {
        resolved.set(token, {
          status: wordData.analysisStatus,
          due: wordData.due,
          cardIds
        });
        continue;
      }

      tokenToCardIds.set(token, cardIds);
      cardIds.forEach((cardId) => allCardIds.add(cardId));
    }

    const unresolvedCardIds = Array.from(allCardIds);
    const metricsMap =
      unresolvedCardIds.length > 0
        ? await this.anki.cardMetricsMap(unresolvedCardIds, ['prop:r', 'prop:s'])
        : new Map();
    const newCardIds =
      unresolvedCardIds.length > 0
        ? await this._resolveNewCardIdsFromMetrics(unresolvedCardIds, metricsMap)
        : new Set();

    for (const token of tokens) {
      if (resolved.has(token) && resolved.get(token)?.status !== 'uncollected') {
        continue;
      }

      const cardIds = tokenToCardIds.get(token);
      if (!cardIds || !cardIds.length) {
        continue;
      }

      let bestStatus: DocumentTokenStatus = 'unknown';
      let bestPriority = -1;
      let due = false;

      for (const cardId of cardIds) {
        const isNewCard = newCardIds.has(cardId);
        const learningStatus = this._classifyLearningStatus(metricsMap.get(cardId), isNewCard);
        const cardDue = this._isCardDue(metricsMap.get(cardId), isNewCard);

        if (cardDue) {
          due = true;
        }

        const priority = this._documentStatusPriority(learningStatus);
        if (priority > bestPriority) {
          bestStatus = learningStatus;
          bestPriority = priority;
        }
      }

      const wordData: CachedWordData = {
        status: this._pickBestStatus(
          cardIds,
          new Map(
            cardIds.map((cardId) => [
              cardId,
              this._classifyCardMetrics(metricsMap.get(cardId), newCardIds.has(cardId))
            ])
          )
        ),
        analysisStatus: bestStatus,
        due,
        cardIds
      };

      if (this.cacheService) {
        await this.cacheService.setWordData(token, wordData);
      }

      resolved.set(token, { status: bestStatus, due, cardIds });
    }

    return resolved;
  }
}
