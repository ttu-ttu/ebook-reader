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
  private cacheService?: AnkiCacheService;
  private options: ColoringOptions;

  constructor(options: ColoringOptions, cacheService?: AnkiCacheService) {
    this.options = options;
    this.yomitan = new Yomitan(options.yomitanUrl);
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
   * Colorize a text string by tokenizing and applying colors
   * @param text - Text to colorize
   * @returns HTML string with colored tokens
   */
  private async _colorizeText(text: string): Promise<string> {
    try {
      let coloredHtml = '';

      // Tokenize using Yomitan (check caches: memory -> persistent -> API)
      let tokens = this.tokenizeCache.get(text);
      if (!tokens && this.cacheService) {
        tokens = await this.cacheService.getTokens(text);
        if (tokens) {
          this.tokenizeCache.set(text, tokens);
        }
      }
      if (!tokens) {
        tokens = await this.yomitan.tokenize(text);
        this.tokenizeCache.set(text, tokens);

        // Persist to IndexedDB cache
        if (this.cacheService) {
          await this.cacheService.setTokens(text, tokens);
        }
      }

      // Color each token
      for (const rawToken of tokens) {
        const trimmedToken = rawToken.trim();

        // Skip non-letter tokens (symbols, numbers, whitespace)
        if (!HAS_LETTER_REGEX.test(trimmedToken)) {
          coloredHtml += this._applyTokenStyle(rawToken, TokenColor.MATURE);
          continue;
        }

        // Get token color from Anki
        const tokenColor = await this._getTokenColor(trimmedToken);

        // Try lemmatized (deinflected) forms if uncollected
        let finalColor = tokenColor;
        if (tokenColor === TokenColor.UNCOLLECTED) {
          let lemmatizedTokens = this.lemmatizeCache.get(trimmedToken);
          if (!lemmatizedTokens && this.cacheService) {
            lemmatizedTokens = await this.cacheService.getLemmas(trimmedToken);
            if (lemmatizedTokens) {
              this.lemmatizeCache.set(trimmedToken, lemmatizedTokens);
            }
          }
          if (!lemmatizedTokens) {
            lemmatizedTokens = await this.yomitan.lemmatize(trimmedToken);
            this.lemmatizeCache.set(trimmedToken, lemmatizedTokens);

            // Persist to IndexedDB cache
            if (this.cacheService) {
              await this.cacheService.setLemmas(trimmedToken, lemmatizedTokens);
            }
          }

          // Check each lemmatized form
          for (const lemmatizedToken of lemmatizedTokens) {
            const lemmatizedColor = await this._getTokenColor(lemmatizedToken);
            if (lemmatizedColor !== TokenColor.UNCOLLECTED) {
              finalColor = lemmatizedColor;
              break;
            }
          }
        }

        coloredHtml += this._applyTokenStyle(rawToken, finalColor);
      }

      return coloredHtml;
    } catch (error) {
      console.error('Error colorizing text:', error);
      return this._applyTokenStyle(text, TokenColor.ERROR);
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

    // Also clear persistent cache
    if (this.cacheService) {
      await this.cacheService.clearAllCaches();
    }
  }
}
