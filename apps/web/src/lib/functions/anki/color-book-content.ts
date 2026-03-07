/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { Yomitan } from '$lib/data/yomitan';
import { Anki, type CardInfo } from '$lib/data/anki';
import {
  TokenColor,
  TokenColorPalette,
  TokenStyle,
  type WordStatus
} from '$lib/data/anki/token-color';
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
  colorPalette: TokenColorPalette;
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
  private tokenizeCache = new Map<string, string[]>();
  private lemmatizeCache = new Map<string, string[]>();
  private tokenColorCache = new Map<string, TokenColor>();
  // Single cache: word -> {status, cardIds}
  private wordDataCache = new Map<string, { status: WordStatus; cardIds: number[] }>();
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
    this.tokenColorCache.clear();
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
      const retrievabilityCache = await this.anki.buildRetrievabilityCacheForDecks();

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
    status: WordStatus
  ): Promise<GradeDialogInfo> {
    let cardInfo: CardInfo | undefined;
    try {
      const cardInfos = await this.anki.cardsInfo([cardId], ['prop:r'], undefined, {
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
        const legacyInfos = await this.anki.cardsInfo([cardId], ['prop:r'], undefined, {
          noteFields: this.options.wordFields,
          compact: true
        });
        cardInfo = legacyInfos[0];
      } catch (legacyError) {
        console.debug(
          `cardsInfo compact/noteFields not available for popup card ${cardId}, falling back to full:`,
          legacyError
        );
        const fallbackInfos = await this.anki.cardsInfo([cardId], ['prop:r']);
        cardInfo = fallbackInfos[0];
      }
    }

    const deckName = cardInfo?.deckName || 'Unknown Deck';
    const preferredField = this._extractPreferredField(cardInfo);
    const fieldLabel = preferredField?.name ? `Field (${preferredField.name})` : 'Field Value';
    const fieldValue = preferredField?.value || 'Unavailable';
    const rawPropR = cardInfo?.['prop:r'];
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

    const retrievability = this._formatRetrievabilityText(exactRetrievability, status, isNewCard);
    const stability =
      typeof cardInfo?.interval === 'number'
        ? `${cardInfo.interval} day${cardInfo.interval === 1 ? '' : 's'}`
        : 'Unavailable';

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
    status: WordStatus,
    isNewCard: boolean
  ): string {
    if (isNewCard) {
      return 'New card (not reviewed yet)';
    }

    const bucket = this._statusToRetrievabilityText(status);
    if (typeof exactRetrievability === 'number') {
      return `${(exactRetrievability * 100).toFixed(2)}% (${bucket})`;
    }

    return bucket;
  }

  private _statusToRetrievabilityText(status: WordStatus): string {
    switch (status) {
      case 'mature':
        return '> 90%';
      case 'young':
        return '> 80%';
      case 'new':
        return '>= 60%';
      case 'low':
        return '< 60%';
      default:
        return 'Unknown';
    }
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

  private async _resolveWordDataForToken(
    token: string
  ): Promise<{ status: WordStatus; cardIds: number[] } | undefined> {
    let existingData = await this._getWordData(token);

    // If not found directly, try lemmatizing to find the base form
    if (!existingData || existingData.cardIds.length === 0) {
      const lemmas = await this.yomitan.lemmatize(token);

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

      // Get existing card IDs from cache (memory + IndexedDB)
      // Try direct lookup first, then lemmatization
      const existingData = await this._resolveWordDataForToken(token);

      if (!existingData || existingData.cardIds.length === 0) {
        console.log(`🔄 Token "${token}" has no cached card IDs, performing full refresh`);
        // Clear caches and do full fetch
        this.wordDataCache.delete(token);
        this.tokenColorCache.delete(token);
        const wordData = await this._fetchWordDataFromAnki(token);

        if (!wordData) {
          console.log(`🔄 Token "${token}" not found in Anki (unknown/uncollected)`);
          return;
        }

        // Update caches
        this.wordDataCache.set(token, wordData);

        // Update IndexedDB cache with fresh data
        if (this.cacheService) {
          await this.cacheService.setWordData(token, wordData.status, wordData.cardIds);
          console.log(`💾 Updated cache for "${token}": ${wordData.status}`);
        }

        // Map status to color
        const color = this._statusToColor(wordData.status);

        this.tokenColorCache.set(token, color);

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
        await this.cacheService.setWordData(token, wordData.status, wordData.cardIds);
        console.log(`💾 Updated cache for "${token}": ${wordData.status}`);
      }

      // Update in-memory cache
      this.wordDataCache.set(token, wordData);

      // Map status to color (same logic as in _checkTokenColors)
      const color = this._statusToColor(wordData.status);

      // Update token color cache
      this.tokenColorCache.set(token, color);

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
  private async _fetchWordDataFromAnki(
    token: string
  ): Promise<{ status: WordStatus; cardIds: number[] } | undefined> {
    try {
      // Get lemmas for this token
      const lemmas = await this.yomitan.lemmatize(token);
      // Always include the original token - some forms are not returned by lemmatization.
      const candidateWords = Array.from(
        new Set([token, ...lemmas].map((word) => word.trim()).filter((word) => word.length > 0))
      );

      // Check all candidates against Anki
      let bestStatus: WordStatus = 'unknown';
      const allCardIds = new Set<number>();

      for (const candidateWord of candidateWords) {
        // Find cards with this candidate in configured word fields
        const cardIds = await this.anki.findCardsWithWord(candidateWord, this.anki.getWordFields());

        if (cardIds.length > 0) {
          cardIds.forEach((id) => allCardIds.add(id));

          // Check retrievability category for each card using prop:r queries
          for (const cardId of cardIds) {
            const status = await this._checkCardRetrievability(cardId);

            // Update best status (priority: mature > young > new > low > unknown)
            if (status === 'mature') {
              bestStatus = 'mature';
              break; // Found mature, stop searching
            } else if (status === 'young') {
              bestStatus = 'young';
            } else if (status === 'new' && (bestStatus === 'unknown' || bestStatus === 'low')) {
              bestStatus = 'new';
            } else if (status === 'low' && bestStatus === 'unknown') {
              bestStatus = 'low';
            }
          }

          // If we found a mature card, stop searching candidates
          if (bestStatus === 'mature') break;
        }
      }

      // If no cards found, return undefined
      if (allCardIds.size === 0) {
        return undefined;
      }

      return {
        status: bestStatus,
        cardIds: Array.from(allCardIds)
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
      const isNewCard = await this.anki.isCardNew(cardId);
      if (isNewCard) {
        return 'new';
      }

      const retrievability = await this.anki.cardRetrievability(cardId, 4, false);
      if (typeof retrievability !== 'number') {
        return 'unknown';
      }

      if (retrievability > 0.9) {
        return 'mature';
      }

      if (retrievability > 0.8) {
        return 'young';
      }

      if (retrievability >= 0.6) {
        return 'new';
      }

      return 'low';
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
      // Fast path: one request via findCards(fields=["prop:r"]).
      const retrievabilityMap = await this.anki.cardRetrievabilityMap(uniqueCardIds);
      if (retrievabilityMap.size > 0) {
        for (const cardId of uniqueCardIds) {
          const retrievability = retrievabilityMap.get(cardId);

          if (typeof retrievability === 'number') {
            if (retrievability > 0.9) {
              result.set(cardId, 'mature');
            } else if (retrievability > 0.8) {
              result.set(cardId, 'young');
            } else if (retrievability >= 0.6) {
              result.set(cardId, 'new');
            } else {
              result.set(cardId, 'low');
            }
          } else if (retrievability === null) {
            // prop:r can be null for unreviewed cards.
            result.set(cardId, 'new');
          } else {
            result.set(cardId, 'unknown');
          }
        }

        return result;
      }
    } catch {
      // Fallback to query-bucket approach below when prop fields are not supported.
    }

    // Build card ID filter: (cid:123 OR cid:456 OR cid:789)
    const cidFilter = `(${uniqueCardIds.map((id) => `cid:${id}`).join(' OR ')})`;

    try {
      // Query 0: Find brand-new cards (never reviewed) and treat them as new.
      const newCardsQuery = `${cidFilter} is:new`;
      const newCardsResponse = await this.anki['_executeAction']('findCards', {
        query: newCardsQuery
      });
      const newCardsFromIsNew: number[] = newCardsResponse.result || [];
      for (const cardId of newCardsFromIsNew) {
        result.set(cardId, 'new');
      }

      // Query 1: Find mature cards (>90%)
      const matureQuery = `${cidFilter} prop:r>0.9`;
      const matureResponse = await this.anki['_executeAction']('findCards', { query: matureQuery });
      const matureCardIds: number[] = matureResponse.result || [];

      for (const cardId of matureCardIds) {
        result.set(cardId, 'mature');
      }

      // Query 2: Find young cards (80%-90%)
      const youngQuery = `${cidFilter} prop:r>0.8 -prop:r>0.9`;
      const youngResponse = await this.anki['_executeAction']('findCards', { query: youngQuery });
      const youngCardIds: number[] = youngResponse.result || [];

      for (const cardId of youngCardIds) {
        result.set(cardId, 'young');
      }

      // Query 3: Find medium cards (60%-80%)
      const newQuery = `${cidFilter} prop:r>=0.6 -prop:r>0.8`;
      const newResponse = await this.anki['_executeAction']('findCards', { query: newQuery });
      const newCardIds: number[] = newResponse.result || [];

      for (const cardId of newCardIds) {
        result.set(cardId, 'new');
      }

      // All remaining cards are low (<60%)
      for (const cardId of uniqueCardIds) {
        if (!result.has(cardId)) {
          result.set(cardId, 'low');
        }
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
  ): Promise<{ status: WordStatus; cardIds: number[] } | undefined> {
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
      const color = this._statusToColor(wordData.status);

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

      // Cache and store
      this.tokenColorCache.set(token, finalColor);
      colorMap.set(token, finalColor);
    }
  }

  private _statusToColor(status: WordStatus): TokenColor {
    if (this.options.colorPalette === TokenColorPalette.SIMPLE) {
      switch (status) {
        case 'low':
          return TokenColor.LOW;
        case 'unknown':
          return TokenColor.UNKNOWN;
        default:
          return TokenColor.UNKNOWN;
      }
    }

    switch (status) {
      case 'mature':
        return TokenColor.MATURE;
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
      console.log('Retrievability thresholds: >0.9, >0.8, >=0.6, <0.6');

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

      // Step 2: Build retrievability cache using prop:r queries
      console.log('Step 2: Building retrievability cache with prop:r queries...');
      const retrievabilityCache = await this.anki.buildRetrievabilityCacheForDecks();
      console.log(`Retrievability cache has ${retrievabilityCache.size} card entries`);

      // Step 3: Build single cache: word -> {status, cardIds}
      console.log('Step 3: Mapping words to status...');
      let matureCount = 0,
        youngCount = 0,
        newCount = 0,
        lowCount = 0,
        unknownCount = 0;

      for (const [word, cardIds] of wordToCardIds.entries()) {
        // Determine status from retrievability cache (prefer mature > young > new > low > unknown)
        let status: WordStatus = 'unknown';

        // Check cards against retrievability categories from prop:r queries
        for (const cardId of cardIds) {
          const category = retrievabilityCache.get(cardId);

          if (category === 'mature') {
            status = 'mature';
            break; // Mature is highest priority
          } else if (category === 'young') {
            status = 'young';
          } else if (category === 'new' && (status === 'unknown' || status === 'low')) {
            status = 'new';
          } else if (category === 'low' && status === 'unknown') {
            status = 'low';
          }
        }

        // Count by status
        if (status === 'mature') matureCount++;
        else if (status === 'young') youngCount++;
        else if (status === 'new') newCount++;
        else if (status === 'low') lowCount++;
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
        `Words by status: ${matureCount} mature, ${youngCount} young, ${newCount} new, ${lowCount} low, ${unknownCount} unknown`
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

  private _normalizeFieldValue(value: string): string {
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
