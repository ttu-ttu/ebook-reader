/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Yomitan API client for Japanese text tokenization and lemmatization
 * Based on asbplayer implementation: https://github.com/ShanaryS/asbplayer/tree/yomitan-anki
 */
export class Yomitan {
  private readonly yomitanUrl: string;
  private readonly scanLength: number;

  constructor(yomitanUrl = 'http://127.0.0.1:19633', scanLength = 16) {
    this.yomitanUrl = yomitanUrl;
    this.scanLength = scanLength;
  }

  /**
   * Tokenize Japanese text into words using Yomitan's morphological analysis
   * @param text - Japanese text to tokenize
   * @param yomitanUrl - Optional override for Yomitan URL
   * @returns Array of tokens (words)
   */
  async tokenize(text: string, yomitanUrl?: string): Promise<string[]> {
    const response = await this._executeAction(
      'tokenize',
      { text, scanLength: this.scanLength },
      yomitanUrl
    );

    const tokens: string[] = [];
    for (const res of response) {
      for (const tokenParts of res['content']) {
        // Flatten nested token parts: [[the], [c, a, r]] -> [the, car]
        tokens.push(tokenParts.map((p: any) => p['text']).join(''));
      }
    }

    return tokens;
  }

  /**
   * Get lemmatized (deinflected) forms of a token
   * Example: 食べた (tabeta) -> [食べる (taberu)]
   * @param token - Token to lemmatize
   * @param yomitanUrl - Optional override for Yomitan URL
   * @returns Array of lemmatized forms
   */
  async lemmatize(token: string, yomitanUrl?: string): Promise<string[]> {
    const response = await this._executeAction('termEntries', { term: token }, yomitanUrl);

    const lemmas: string[] = [];
    for (const entry of response['dictionaryEntries']) {
      for (const headword of entry['headwords']) {
        for (const source of headword['sources']) {
          if (source.originalText !== token) continue;
          if (source.matchType !== 'exact') continue;

          const lemma = source.deinflectedText;
          if (lemma === token) continue; // Skip if same as input
          if (lemmas.includes(lemma)) continue; // Skip duplicates

          lemmas.push(lemma);
        }
      }
    }

    return lemmas;
  }

  /**
   * Test connection to Yomitan extension
   * @param yomitanUrl - Optional override for Yomitan URL
   * @returns Version information
   */
  async version(yomitanUrl?: string): Promise<any> {
    return this._executeAction('yomitanVersion', null, yomitanUrl);
  }

  /**
   * Execute an action against Yomitan API
   * @param path - API endpoint path
   * @param body - Request body
   * @param yomitanUrl - Optional override for Yomitan URL
   * @returns API response
   * @throws Error if request fails or returns error
   */
  private async _executeAction(
    path: string,
    body: object | null,
    yomitanUrl?: string
  ): Promise<any> {
    const url = `${yomitanUrl || this.yomitanUrl}/${path}`;

    // Use text/plain to avoid CORS preflight (Yomitan's BaseHTTP doesn't support OPTIONS)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) {
      throw new Error(`Yomitan API request failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    if (!json || Object.keys(json).length === 0) {
      throw new Error('Yomitan API returned empty response');
    }

    if (json.error) {
      throw new Error(`Yomitan API error: ${json.error}`);
    }

    return json;
  }
}
