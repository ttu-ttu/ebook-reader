/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import { Yomitan } from '$lib/data/yomitan';
import { Anki, type CardInfo } from '$lib/data/anki';
import { TokenColor, TokenStyle } from '$lib/data/anki/token-color';

/** Regex to check if text contains letters */
const HAS_LETTER_REGEX = /\p{L}/u;

export interface ColoringOptions {
  enabled: boolean;
  yomitanUrl: string;
  ankiConnectUrl: string;
  wordFields: string[];
  sentenceFields: string[];
  matureThreshold: number;
  tokenStyle: TokenStyle;
  deckName: string;
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
  private options: ColoringOptions;

  constructor(options: ColoringOptions) {
    this.options = options;
    this.yomitan = new Yomitan(options.yomitanUrl);
    this.anki = new Anki(
      options.ankiConnectUrl,
      options.wordFields,
      options.sentenceFields,
      options.deckName
    );
  }

  /**
   * Colorize HTML content by applying token coloring
   * @param html - HTML content to colorize
   * @returns Colorized HTML content
   * @deprecated Use colorizeElement for incremental viewport-based coloring
   */
  async colorizeHtml(html: string): Promise<string> {
    if (!this.options.enabled) return html;

    try {
      // Parse HTML using browser DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Find all text nodes (skip ruby/rt tags)
      const textNodes = this._getTextNodes(doc.body);

      // Process each text node
      for (const textNode of textNodes) {
        if (!textNode.textContent || !textNode.parentElement) continue;

        const coloredHtml = await this._colorizeText(textNode.textContent);
        const span = doc.createElement('span');
        span.innerHTML = coloredHtml;

        // Replace text node with colored span
        textNode.parentElement.replaceChild(span, textNode);
      }

      return doc.body.innerHTML;
    } catch (error) {
      console.error('Error colorizing book content:', error);
      return html; // Return original on error
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

      // Tokenize using Yomitan
      let tokens = this.tokenizeCache.get(text);
      if (!tokens) {
        tokens = await this.yomitan.tokenize(text);
        this.tokenizeCache.set(text, tokens);
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
          if (!lemmatizedTokens) {
            lemmatizedTokens = await this.yomitan.lemmatize(trimmedToken);
            this.lemmatizeCache.set(trimmedToken, lemmatizedTokens);
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
    // Check cache first
    const cached = this.tokenColorCache.get(token);
    if (cached !== undefined) return cached;

    try {
      // Search in word fields first (exact match)
      let cardIds = await this.anki.findCardsWithWord(token, this.anki.getWordFields());

      if (cardIds.length) {
        const intervals = await this.anki.currentIntervals(cardIds);
        const color = this._getColorFromIntervals(intervals);
        this.tokenColorCache.set(token, color);
        return color;
      }

      // Search in sentence fields (partial match)
      cardIds = await this.anki.findCardsContainingWord(token, this.anki.getSentenceFields());

      if (!cardIds.length) {
        this.tokenColorCache.set(token, TokenColor.UNCOLLECTED);
        return TokenColor.UNCOLLECTED;
      }

      // Verify token actually appears in sentence field (tokenized match)
      const cardInfos = await this.anki.cardsInfo(cardIds);
      const validCardInfos = await this._filterCardsContainingToken(cardInfos, token);

      if (!validCardInfos.length) {
        this.tokenColorCache.set(token, TokenColor.UNCOLLECTED);
        return TokenColor.UNCOLLECTED;
      }

      const intervals = validCardInfos.map((info) => info.interval);
      const color = this._getColorFromIntervals(intervals);
      this.tokenColorCache.set(token, color);
      return color;
    } catch (error) {
      console.error(`Error getting color for token "${token}":`, error);
      return TokenColor.ERROR;
    }
  }

  /**
   * Filter cards to only those that actually contain the token when tokenized
   * This prevents false positives from substring matches
   * @param cardInfos - Card information objects
   * @param token - Token to search for
   * @returns Filtered card information
   */
  private async _filterCardsContainingToken(
    cardInfos: CardInfo[],
    token: string
  ): Promise<CardInfo[]> {
    const validCards: CardInfo[] = [];

    for (const cardInfo of cardInfos) {
      for (const sentenceField of this.anki.getSentenceFields()) {
        const field = cardInfo.fields[sentenceField];
        if (!field) continue;

        // Tokenize sentence field to check if token is present
        let fieldTokens = this.tokenizeCache.get(field.value);
        if (!fieldTokens) {
          fieldTokens = await this.yomitan.tokenize(field.value);
          this.tokenizeCache.set(field.value, fieldTokens);
        }

        // Check if token exists in tokenized field
        if (fieldTokens.map((t) => t.trim()).includes(token)) {
          validCards.push(cardInfo);
          break; // Found in this card, move to next card
        }
      }
    }

    return validCards;
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
   * Clear all caches
   */
  clearCache(): void {
    this.tokenizeCache.clear();
    this.lemmatizeCache.clear();
    this.tokenColorCache.clear();
  }
}
