/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Yomitan } from '$lib/data/yomitan';
import { Anki, type CardInfo } from '$lib/data/anki';
import {
  TokenColor,
  TokenColorMode,
  TokenColorPalette,
  TokenStyle,
  type WordStatus
} from '$lib/data/anki/token-color';
import type { AnkiCacheService } from '$lib/data/database/anki-cache-db';
import type { CachedWordData } from '$lib/data/database/anki-cache-db/anki-cache.service';

/** Regex to check if text contains letters */
const HAS_LETTER_REGEX = /\p{L}/u;

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
  // Rate limiting: track last refresh timestamp for each token
  private lastRefreshTime = new Map<string, number>();
  private readonly REFRESH_COOLDOWN_MS = 5000; // 5 seconds

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
    lowCards: number;
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
      const lowCards = Array.from(retrievabilityCache.values()).filter((c) => c === 'low').length;

      return { matureCards, youngCards, newCards, lowCards };
    } catch (error) {
      console.error('Error building retrievability cache:', error);
      return { matureCards: 0, youngCards: 0, newCards: 0, lowCards: 0 };
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
                ? globalColorMap.get(trimmed) || TokenColor.UNCOLLECTED
                : TokenColor.UNCOLLECTED;

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
          completedSteps = textChunks.length;
          reportProgress('tokenize', completedSteps, totalSteps);
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
    }

    const uniqueTokens = Array.from(uniqueCounts.keys());
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

  async refreshTokenAnalysisFromAnki(token: string): Promise<{
    status: DocumentTokenStatus;
    due: boolean;
    cardIds: number[];
  }> {
    const trimmedToken = token.trim();
    if (!HAS_LETTER_REGEX.test(trimmedToken)) {
      return { status: 'uncollected', due: false, cardIds: [] };
    }

    const fetched = await this._fetchWordDataFromAnki(trimmedToken);
    if (!fetched) {
      const unknownWordData: CachedWordData = {
        status: 'unknown',
        analysisStatus: 'uncollected',
        due: false,
        cardIds: []
      };

      if (this.cacheService) {
        await this.cacheService.setWordData(trimmedToken, unknownWordData);
      }

      return { status: 'uncollected', due: false, cardIds: [] };
    }

    const dedupedCardIds = Array.from(new Set((fetched.cardIds || []).filter(Number.isFinite)));
    let analysisStatus = fetched.analysisStatus;
    let due = fetched.due;

    if (analysisStatus === undefined || due === undefined) {
      const metricsMap = await this.anki.cardMetricsMap(dedupedCardIds, ['prop:r', 'prop:s']);
      const newCardIds = await this._findNewCardIds(dedupedCardIds);

      let bestStatus: DocumentTokenStatus = 'unknown';
      let bestPriority = -1;
      let computedDue = false;

      for (const cardId of dedupedCardIds) {
        const isNewCard = newCardIds.has(cardId);
        const status = this._classifyLearningStatus(metricsMap.get(cardId), isNewCard);
        const isDue = this._isCardDue(metricsMap.get(cardId), isNewCard);

        if (isDue) {
          computedDue = true;
        }

        const priority = this._documentStatusPriority(status);
        if (priority > bestPriority) {
          bestStatus = status;
          bestPriority = priority;
        }
      }

      analysisStatus = dedupedCardIds.length > 0 ? bestStatus : 'uncollected';
      due = computedDue;
    }

    const enrichedWordData: CachedWordData = {
      ...fetched,
      analysisStatus: analysisStatus ?? 'unknown',
      due: due ?? false,
      cardIds: dedupedCardIds
    };

    if (this.cacheService) {
      await this.cacheService.setWordData(trimmedToken, enrichedWordData);
    }

    return {
      status: enrichedWordData.analysisStatus || 'unknown',
      due: enrichedWordData.due || false,
      cardIds: enrichedWordData.cardIds
    };
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
    let cardInfo: CardInfo | undefined;
    try {
      const cardInfos = await this.anki.cardsInfo([cardId], ['prop:r', 'prop:s'], undefined, {
        noteFields: this.options.wordFields,
        retrievedInfoMode: 'COMPACT'
      });
      cardInfo = cardInfos[0];
    } catch (error) {
      console.debug(
        `cardsInfo retrieved_info_mode not available for popup card ${cardId}, trying legacy compact:`,
        error
      );
      try {
        const legacyInfos = await this.anki.cardsInfo([cardId], ['prop:r', 'prop:s'], undefined, {
          noteFields: this.options.wordFields,
          compact: true
        });
        cardInfo = legacyInfos[0];
      } catch (legacyError) {
        console.debug(
          `cardsInfo compact/noteFields not available for popup card ${cardId}, falling back to full:`,
          legacyError
        );
        const fallbackInfos = await this.anki.cardsInfo([cardId], ['prop:r', 'prop:s']);
        cardInfo = fallbackInfos[0];
      }
    }

    const deckName = cardInfo?.deckName || 'Unknown Deck';
    const preferredField = this._extractPreferredField(cardInfo);
    const fieldLabel = preferredField?.name ? `Field (${preferredField.name})` : 'Field Value';
    const fieldValue = preferredField?.value || 'Unavailable';
    const rawPropR = cardInfo?.['prop:r'];
    const rawPropS = cardInfo?.['prop:s'];
    let exactRetrievability = typeof rawPropR === 'number' ? rawPropR : undefined;
    let isNewCard = (cardInfo?.queue === 0 || cardInfo?.type === 0) && rawPropR === null;

    // Backward compatibility fallback for older AnkiConnect without cardsInfo(fields).
    if (!isNewCard && typeof exactRetrievability !== 'number') {
      try {
        exactRetrievability = await this.anki.cardRetrievability(cardId, 4, true);
        isNewCard =
          typeof exactRetrievability !== 'number' &&
          (cardInfo?.queue === 0 || cardInfo?.type === 0);
      } catch (error) {
        console.debug(`Failed to fetch exact retrievability for card ${cardId}:`, error);
      }
    }

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

  private async _gradeToken(token: string, span: HTMLElement): Promise<void> {
    try {
      const existingData = await this._resolveWordDataForToken(token);

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

  private async _resolveWordDataForToken(token: string): Promise<CachedWordData | undefined> {
    let existingData = await this._getWordData(token);

    // If not found directly, try lemmatizing to find the base form
    if (!existingData || existingData.cardIds.length === 0) {
      const lemmas = await this._getOrFetchLemmas(token);

      for (const lemma of lemmas) {
        const lemmaData = await this._getWordData(lemma);
        if (lemmaData && lemmaData.cardIds.length > 0) {
          existingData = lemmaData;
          break;
        }
      }
    }

    return existingData;
  }

  /**
   * Refresh a single token by fetching fresh data from Anki
   * Rate limited to once per 5 seconds to avoid excessive queries
   * @param token - Token to refresh
   * @param span - HTML span element to update
   */
  private async _refreshToken(token: string, span: HTMLElement): Promise<void> {
    try {
      // Rate limiting: check if token was refreshed recently
      const now = Date.now();
      const lastRefresh = this.lastRefreshTime.get(token);

      if (lastRefresh && now - lastRefresh < this.REFRESH_COOLDOWN_MS) {
        console.log(
          `⏱️ Token "${token}" was refreshed ${Math.round((now - lastRefresh) / 1000)}s ago, skipping (cooldown: ${this.REFRESH_COOLDOWN_MS / 1000}s)`
        );
        return;
      }

      // Update last refresh timestamp
      this.lastRefreshTime.set(token, now);

      // Get existing card IDs from IndexedDB cache.
      // Try direct lookup first, then lemmatization.
      const existingData = await this._resolveWordDataForToken(token);

      if (!existingData || existingData.cardIds.length === 0) {
        console.log(`🔄 Token "${token}" has no cached card IDs, performing full refresh`);
        // No in-memory cache path: fetch directly from Anki and persist to IndexedDB.
        const wordData = await this._fetchWordDataFromAnki(token);

        if (!wordData) {
          console.log(`🔄 Token "${token}" not found in Anki (unknown/uncollected)`);
          return;
        }

        // Update IndexedDB cache with fresh data
        if (this.cacheService) {
          await this.cacheService.setWordData(token, wordData);
          console.log(`💾 Updated cache for "${token}": ${wordData.status}`);
        }

        // Map status to color
        const color = this._statusToColor(wordData.status);

        // Update span styling
        const style = this.options.tokenStyle;
        const whiteSpaceStyle = 'white-space: pre-wrap;';

        if (style === TokenStyle.TEXT) {
          span.style.cssText = `color: ${color}; ${whiteSpaceStyle}`;
        } else {
          const decoration = color === TokenColor.ERROR ? 'double' : 'solid';
          span.style.cssText = `text-decoration: underline ${color} ${decoration}; ${whiteSpaceStyle}`;
        }

        console.log(
          `🔄 Refreshed token on hover: "${token}" -> status: ${wordData.status}, color: ${color}`
        );
        return;
      }

      // Fast path: reuse existing card IDs and only check retrievability
      console.log(
        `⚡ Fast refresh for "${token}" using ${existingData.cardIds.length} cached card IDs`
      );
      const retrievabilityCache = await this._batchCheckCardRetrievability(existingData.cardIds);

      // Determine new status
      let newStatus: WordStatus = 'unknown';
      for (const cardId of existingData.cardIds) {
        const status = retrievabilityCache.get(cardId) || 'unknown';

        if (status === 'mature') {
          newStatus = 'mature';
          break;
        } else if (status === 'young') {
          newStatus = 'young';
        } else if (status === 'new' && (newStatus === 'unknown' || newStatus === 'low')) {
          newStatus = 'new';
        } else if (status === 'low' && newStatus === 'unknown') {
          newStatus = 'low';
        }
      }

      let wordData = {
        status: newStatus,
        cardIds: existingData.cardIds
      };

      // Cached IDs can be stale or mismatched (e.g. legacy cache shape).
      // If classification from IDs is inconclusive, re-fetch by token/candidates.
      if (wordData.status === 'unknown') {
        console.log(`🔄 Fast refresh inconclusive for "${token}", falling back to token lookup`);
        const refreshedWordData = await this._fetchWordDataFromAnki(token);
        if (refreshedWordData) {
          wordData = refreshedWordData;
        }
      }

      // Update IndexedDB cache with fresh data
      if (this.cacheService) {
        await this.cacheService.setWordData(token, wordData);
        console.log(`💾 Updated cache for "${token}": ${wordData.status}`);
      }

      // Map status to color (same logic as in _checkTokenColors)
      const color = this._statusToColor(wordData.status);

      // Update the span styling with new color
      const style = this.options.tokenStyle;
      const whiteSpaceStyle = 'white-space: pre-wrap;';

      if (style === TokenStyle.TEXT) {
        span.style.cssText = `color: ${color}; ${whiteSpaceStyle}`;
      } else {
        const decoration = color === TokenColor.ERROR ? 'double' : 'solid';
        span.style.cssText = `text-decoration: underline ${color} ${decoration}; ${whiteSpaceStyle}`;
      }

      console.log(
        `🔄 Refreshed token on hover: "${token}" -> status: ${wordData.status}, color: ${color}`
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
      // Get lemmas for this token
      const lemmas = await this.yomitan.lemmatize(token);
      // Always include the original token - some forms are not returned by lemmatization.
      const candidateWords = Array.from(
        new Set([token, ...lemmas].map((word) => word.trim()).filter((word) => word.length > 0))
      );

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
      const newCardIds = await this._findNewCardIds(resolvedCardIds);
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

  /**
   * Check retrievability category for a single card using Anki search queries
   * @param cardId - Card ID to check
   * @returns Card status: 'mature', 'young', 'new', 'low', or 'unknown'
   */
  private async _checkCardRetrievability(cardId: number): Promise<WordStatus> {
    try {
      const isNewCard = (await this._findNewCardIds([cardId])).has(cardId);
      const metrics = await this.anki.cardMetricsMap([cardId], ['prop:r', 'prop:s']);
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
        const newCardIds = await this._findNewCardIds(uniqueCardIds);

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
          tokenColorMap.set(trimmedToken, TokenColor.UNCOLLECTED);
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

  private async _getOrFetchLemmas(token: string): Promise<string[]> {
    // IndexedDB is the source of truth.
    if (this.cacheService) {
      const lemmas = await this.cacheService.getLemmas(token);
      if (lemmas) return lemmas;
    }

    // Fetch from Yomitan API
    const lemmas = await this.yomitan.lemmatize(token);
    if (this.cacheService) {
      await this.cacheService.setLemmas(token, lemmas);
    }

    return lemmas;
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
    const uncollectedTokens: string[] = [];

    // Look up tokens in IndexedDB cache
    for (const token of tokens) {
      // Look up word data from cache
      let wordData = await this._getWordData(token);

      // If no direct entry, try lemmas as a fallback (local cache -> persistent cache -> yomitan)
      if (!wordData || wordData.cardIds.length === 0) {
        try {
          const lemmas = await this._getOrFetchLemmas(token);

          if (lemmas && lemmas.length > 0) {
            console.debug(`🔍 Token "${token}" lemmatized to:`, lemmas);
            // Try to find a lemma that exists in IndexedDB wordData with cardIds
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
      const color = this._statusToColor(wordData.status);

      console.debug(`🎨 Token "${token}" -> status: ${wordData.status}, color: ${color}`);

      if (color === TokenColor.UNCOLLECTED) {
        uncollectedTokens.push(token);
        continue;
      }

      colorMap.set(token, color);
    }

    // Handle uncollected tokens with lemmatization
    if (uncollectedTokens.length > 0) {
      await this._handleUncollectedTokensBatch(uncollectedTokens, colorMap);
    }
  }

  /**
   * Handle uncollected tokens by lemmatizing and checking lemmas
   * Uses pre-built retrievability cache for instant lookups (no API calls!)
   * @param tokens - Array of uncollected tokens
   * @param colorMap - Map to populate with token -> color mappings
   */
  private async _handleUncollectedTokensBatch(
    tokens: string[],
    colorMap: Map<string, TokenColor>
  ): Promise<void> {
    // Parallelize lemmatization
    const lemmaPromises = tokens.map(async (token) => {
      const lemmas = await this._getOrFetchLemmas(token);
      return { token, lemmas };
    });

    const lemmaResults = await Promise.all(lemmaPromises);

    const tokenToLemmas = new Map<string, string[]>();

    for (const { token, lemmas } of lemmaResults) {
      tokenToLemmas.set(token, lemmas);
    }

    // Look up lemmas using IndexedDB as primary cache
    // Process each uncollected token
    for (const token of tokens) {
      const lemmas = tokenToLemmas.get(token) || [];
      let finalStatus: WordStatus | undefined;
      let finalPriority = -1;

      // Check each lemma - use the highest priority status found
      for (const lemma of lemmas) {
        const wordData = await this._getWordData(lemma);

        if (wordData && wordData.cardIds.length > 0) {
          const currentPriority = this._statusPriority(wordData.status);
          if (currentPriority > finalPriority) {
            finalStatus = wordData.status;
            finalPriority = currentPriority;
          }
        }

        if (finalStatus === 'mature') break; // Already found highest status, stop
      }

      const finalColor = finalStatus ? this._statusToColor(finalStatus) : TokenColor.UNCOLLECTED;

      colorMap.set(token, finalColor);
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
      case 'low':
        return TokenColor.LOW;
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
    const retrievability = metric?.['prop:r'];
    const stability = metric?.['prop:s'];
    const highRetrievability =
      typeof retrievability === 'number' && retrievability >= this.getDesiredRetention();
    const highStability = typeof stability === 'number' && stability >= this.getMatureThreshold();

    switch (this.options.colorMode) {
      case TokenColorMode.STABILITY:
        if (typeof stability !== 'number') {
          return isNewCard ? 'low' : 'unknown';
        }
        return highStability ? 'mature' : 'low';
      case TokenColorMode.RETRIEVABILITY:
        if (typeof retrievability !== 'number') {
          return isNewCard ? 'low' : 'unknown';
        }
        return highRetrievability ? 'mature' : 'low';
      case TokenColorMode.COMBINED:
      default:
        if ((typeof stability !== 'number' && typeof retrievability !== 'number') || isNewCard) {
          return isNewCard ? 'low' : 'unknown';
        }

        if (highStability && highRetrievability) {
          return 'mature';
        }
        if (highStability && !highRetrievability) {
          return 'young';
        }
        if (!highStability && highRetrievability) {
          return 'new';
        }
        return 'low';
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

  private async _findNewCardIds(cardIds: number[]): Promise<Set<number>> {
    const result = new Set<number>();
    const uniqueCardIds = Array.from(new Set(cardIds.filter((cardId) => Number.isFinite(cardId))));
    const chunkSize = 250;

    for (let index = 0; index < uniqueCardIds.length; index += chunkSize) {
      const chunk = uniqueCardIds.slice(index, index + chunkSize);
      try {
        const response = await this.anki['_executeAction']('findCards', {
          query: `(${chunk.map((cardId) => `cid:${cardId}`).join(' OR ')}) is:new`
        });

        for (const cardId of (response.result || []).filter((id: number) => Number.isFinite(id))) {
          result.add(cardId);
        }
      } catch (error) {
        console.debug('Failed to fetch new card IDs:', error);
      }
    }

    return result;
  }

  private _statusPriority(status: WordStatus): number {
    switch (status) {
      case 'mature':
        return 5;
      case 'young':
        return 4;
      case 'new':
        return 3;
      case 'low':
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
      const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
      const needsRefresh = cacheAge > CACHE_TTL_MS;

      console.log(
        `📦 Cache exists (age: ${Math.round(cacheAge / 60000)} min, TTL: ${Math.round(CACHE_TTL_MS / 60000)} min) - needsRefresh: ${needsRefresh}`
      );

      // Return 0 loaded words since we're not preloading anymore
      return { loadedWords: 0, needsRefresh, cacheAge };
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
            const rawWord = fieldValue.trim();
            const normalizedWord = this._normalizeFieldValue(fieldValue);

            if (rawWord) {
              const cardIds = wordToCardIds.get(rawWord) || [];
              if (!cardIds.includes(card.cardId)) {
                cardIds.push(card.cardId);
                wordToCardIds.set(rawWord, cardIds);
              }
            }

            // Add plain-text variant to support HTML-rich fields (e.g. wrapped Front content).
            if (normalizedWord && normalizedWord !== rawWord) {
              const cardIds = wordToCardIds.get(normalizedWord) || [];
              if (!cardIds.includes(card.cardId)) {
                cardIds.push(card.cardId);
                wordToCardIds.set(normalizedWord, cardIds);
              }
            }
          }
        }
      }

      console.log(`Extracted ${wordToCardIds.size} unique words from cards`);

      // Step 2: Fetch card metrics used by the active coloring mode
      console.log('Step 2: Fetching card metrics (prop:r, prop:s)...');
      const cardIds = allCards.map((card) => card.cardId);
      const metricsByCardId = await this.anki.cardMetricsMap(cardIds, ['prop:r', 'prop:s']);
      const newCardIds = new Set<number>();
      try {
        const query = this.anki
          .getWordDecks()
          .map((deckName) => `"deck:${deckName}"`)
          .join(' OR ');
        const newCardsResponse = await this.anki['_executeAction']('findCards', {
          query: `(${query}) is:new`
        });
        for (const cardId of newCardsResponse.result || []) {
          newCardIds.add(cardId);
        }
      } catch (error) {
        console.debug('Failed to fetch new cards during warm cache:', error);
      }
      console.log(`Fetched metrics for ${metricsByCardId.size} cards`);

      // Step 3: Build single cache: word -> {status, cardIds}
      console.log('Step 3: Mapping words to status...');
      let matureCount = 0,
        youngCount = 0,
        newCount = 0,
        lowCount = 0,
        unknownCount = 0;

      for (const [word, cardIds] of wordToCardIds.entries()) {
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
        else if (status === 'low') lowCount++;
        else unknownCount++;

        const wordData: CachedWordData = {
          status,
          analysisStatus: this._pickBestDocumentStatus(cardIds, documentStatusMap),
          due: cardIds.some((cardId) =>
            this._isCardDue(metricsByCardId.get(cardId), newCardIds.has(cardId))
          ),
          cardIds
        };

        // Store in persistent cache
        if (this.cacheService) {
          await this.cacheService.setWordData(word, wordData);
        }

        cachedWords++;
      }

      console.log(
        `Words by status: ${matureCount} mature, ${youngCount} young, ${newCount} new, ${lowCount} low, ${unknownCount} unknown`
      );

      console.log('🔄 Cache warmed in IndexedDB; future lookups read directly from IndexedDB');

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

  private _normalizeFieldValue(value: string): string {
    return this._canonicalizeLookupValue(
      value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
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

    const tokenToCardIds = new Map<string, number[]>();
    const allCardIds = new Set<number>();

    for (const token of tokens) {
      try {
        const lemmas = await this._getOrFetchLemmas(token);
        const lookupWords = Array.from(
          new Set(
            [token, ...lemmas].map((candidate) => candidate.trim()).filter((candidate) => candidate)
          )
        );

        const cardIds = new Set<number>();
        let bestCached:
          | { status: DocumentTokenStatus; due: boolean; cardIds: number[]; priority: number }
          | undefined;

        for (const lookupWord of lookupWords) {
          const wordData = await this._getWordData(lookupWord);
          if (!wordData || wordData.cardIds.length === 0) {
            continue;
          }

          const dedupedCardIds = Array.from(
            new Set((wordData.cardIds || []).filter((cardId) => Number.isFinite(cardId)))
          );

          if (wordData.analysisStatus !== undefined && wordData.due !== undefined) {
            const priority = this._documentStatusPriority(wordData.analysisStatus);
            const shouldReplace =
              !bestCached ||
              priority > bestCached.priority ||
              (priority === bestCached.priority && wordData.due && !bestCached.due);

            if (shouldReplace) {
              bestCached = {
                status: wordData.analysisStatus,
                due: wordData.due,
                cardIds: dedupedCardIds,
                priority
              };
            }
          }

          dedupedCardIds.forEach((cardId) => cardIds.add(cardId));
        }

        if (bestCached) {
          resolved.set(token, {
            status: bestCached.status,
            due: bestCached.due,
            cardIds: bestCached.cardIds
          });
          continue;
        }

        const resolvedCardIds = Array.from(cardIds);
        tokenToCardIds.set(token, resolvedCardIds);
        resolvedCardIds.forEach((cardId) => allCardIds.add(cardId));
      } catch (error) {
        console.debug(`Document token analysis failed for "${token}"`, error);
        tokenToCardIds.set(token, []);
      }
    }

    const metricsMap = await this.anki.cardMetricsMap(Array.from(allCardIds), ['prop:r', 'prop:s']);
    const newCardIds = await this._findNewCardIds(Array.from(allCardIds));

    for (const token of tokens) {
      // Already resolved from IndexedDB cached analysisStatus/due path.
      if (resolved.has(token)) {
        continue;
      }

      const cardIds = tokenToCardIds.get(token) || [];
      if (cardIds.length === 0) {
        resolved.set(token, { status: 'uncollected', due: false, cardIds: [] });
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
