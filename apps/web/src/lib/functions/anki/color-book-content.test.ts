/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it, vi } from 'vitest';
import { BookContentColoring } from './color-book-content';
import { TokenColorMode, TokenColorPalette, TokenStyle } from '$lib/data/anki/token-color';

function createService(): BookContentColoring {
  return new BookContentColoring({
    enabled: true,
    yomitanUrl: 'http://127.0.0.1:19633',
    ankiConnectUrl: 'http://127.0.0.1:8765',
    wordFields: ['Word'],
    wordDeckNames: ['Deck'],
    colorMode: TokenColorMode.COMBINED,
    desiredRetention: 0.6,
    matureThreshold: 21,
    tokenStyle: TokenStyle.TEXT,
    colorPalette: TokenColorPalette.FULL
  });
}

describe('BookContentColoring single-path resolution', () => {
  it('resolves token status through cached lemma -> wordData mapping', async () => {
    const service = createService() as any;
    service._getWordData = vi.fn(async (word: string) => {
      if (word === '歌う') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: [123]
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({ lemmas: ['歌う'], lemmaReadings: [] }));
    service._fetchWordDataFromAnki = vi.fn();

    const resolved = await service._resolveTokenWordDataBatch(['歌い'], {
      allowTermEntriesEnrichment: true
    });

    expect(resolved.get('歌い')).toEqual({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [123]
    });
    expect(service._fetchWordDataFromAnki).not.toHaveBeenCalled();
  });

  it('keeps the best status when direct token and lemma rows both exist', async () => {
    const service = createService() as any;
    service._getWordData = vi.fn(async (word: string) => {
      if (word === '笑い') {
        return {
          status: 'young',
          analysisStatus: 'young',
          due: false,
          cardIds: [200]
        };
      }
      if (word === '笑う') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: [100]
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({
      lemmas: ['笑う'],
      lemmaReadings: ['わらう']
    }));

    const resolved = await service._resolveTokenWordData('笑い', {
      allowTermEntriesEnrichment: true
    });

    expect(resolved).toEqual({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [100]
    });
  });

  it('persists token wordData when resolution succeeds via lemma candidates', async () => {
    const service = createService() as any;
    const setWordData = vi.fn(async () => {});
    service.cacheService = { setWordData };
    service._getWordData = vi.fn(async (word: string) => {
      if (word === '最近') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: [321]
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({
      lemmas: ['最近'],
      lemmaReadings: ['さいきん']
    }));

    const resolved = await service._resolveTokenWordData('さいきん', {
      allowTermEntriesEnrichment: true
    });

    expect(resolved).toEqual({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [321]
    });
    expect(setWordData).toHaveBeenCalledWith('さいきん', {
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [321]
    });
  });

  it('logs when lemma entries exist but no matching wordData row is found', async () => {
    const service = createService() as any;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    service._getWordData = vi.fn(async () => undefined);
    service._getOrFetchLemmas = vi.fn(async () => ({
      lemmas: ['最近'],
      lemmaReadings: ['さいきん']
    }));

    const resolved = await service._resolveTokenWordData('最近', {
      allowTermEntriesEnrichment: false
    });

    expect(resolved).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[AnkiCache] Lemma mapped token has no matching wordData row',
      expect.objectContaining({
        token: '最近',
        lemmas: expect.arrayContaining(['最近'])
      })
    );
    warnSpy.mockRestore();
  });

  it('keeps stale wordData read-only during token resolution', async () => {
    const service = createService() as any;
    const staleWordData = {
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [777],
      expiresAtMs: Date.now() - 1
    };
    service.cacheService = {
      getWordData: vi.fn(async (word: string) => (word === '最近' ? staleWordData : undefined))
    };
    service._fetchWordDataFromAnki = vi.fn();

    const resolved = await service._getWordData('最近');

    expect(resolved).toEqual(staleWordData);
    expect(service._fetchWordDataFromAnki).not.toHaveBeenCalled();
  });

  it('normalizes dictionary POS-suffixed lemmas for IndexedDB lookup', async () => {
    const service = createService() as any;
    service._getWordData = vi.fn(async (word: string) => {
      if (word === '僕') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: [1730241628479]
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({
      lemmas: ['僕-代名詞'],
      lemmaReadings: ['ぼく']
    }));

    const resolved = await service._resolveTokenWordDataBatch(['ぼく'], {
      allowTermEntriesEnrichment: true
    });

    expect(resolved.get('ぼく')).toEqual({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [1730241628479]
    });
    expect(service._getWordData).toHaveBeenCalledWith('僕');
  });

  it('enriches weak cached lemmas when unresolved and retries IndexedDB lookup', async () => {
    const service = createService() as any;
    service._getWordData = vi.fn(async (word: string) => {
      if (word === '僕') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: [1730241628479]
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({ lemmas: ['ぼく'], lemmaReadings: [] }));
    service.yomitan = {
      lemmatize: vi.fn(async () => ({ lemmas: ['僕'], lemmaReadings: ['ぼく'] }))
    };

    const resolved = await service._resolveTokenWordDataBatch(['ぼく'], {
      allowTermEntriesEnrichment: true
    });

    expect(service.yomitan.lemmatize).toHaveBeenCalledWith('ぼく');
    expect(resolved.get('ぼく')).toEqual({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [1730241628479]
    });
  });

  it('coerces numeric-string card IDs from IndexedDB rows during lemma resolution', async () => {
    const service = createService() as any;
    service._getWordData = vi.fn(async (word: string) => {
      if (word === '笑う') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: ['1730845849864']
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({
      lemmas: ['笑う'],
      lemmaReadings: ['わらう']
    }));

    const resolved = await service._resolveTokenWordDataBatch(['笑い'], {
      allowTermEntriesEnrichment: true
    });

    expect(resolved.get('笑い')).toEqual({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [1730845849864]
    });
  });

  it('uses only kanji lemmas when token surface includes kanji', async () => {
    const service = createService() as any;
    service._getWordData = vi.fn(async (word: string) => {
      if (word === '訊く') {
        return {
          status: 'young',
          analysisStatus: 'young',
          due: false,
          cardIds: [10]
        };
      }
      if (word === 'きく') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: [20]
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({
      lemmas: ['訊く'],
      lemmaReadings: ['きく']
    }));

    const resolved = await service._resolveTokenWordData('訊く', {
      allowTermEntriesEnrichment: true
    });

    expect(resolved).toEqual({
      status: 'young',
      analysisStatus: 'young',
      due: false,
      cardIds: [10]
    });
    expect(service._getWordData).not.toHaveBeenCalledWith('きく');
  });

  it('can use lemmaReadings when token surface is reading', async () => {
    const service = createService() as any;
    service._getWordData = vi.fn(async (word: string) => {
      if (word === 'きく') {
        return {
          status: 'mature',
          analysisStatus: 'mature',
          due: false,
          cardIds: [30]
        };
      }
      return undefined;
    });
    service._getOrFetchLemmas = vi.fn(async () => ({
      lemmas: ['訊く'],
      lemmaReadings: ['きく']
    }));

    const resolved = await service._resolveTokenWordData('きく', {
      allowTermEntriesEnrichment: true
    });

    expect(resolved).toEqual({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [30]
    });
  });

  it('extracts stable field candidates from ruby/annotation-rich values', () => {
    const service = createService() as any;

    const candidates: string[] = service._extractWordFieldCandidates(
      '<ruby>歌<rt>うた</rt>う</ruby>【うたう】, 詠唱'
    );

    expect(candidates).toContain('歌う');
    expect(candidates).toContain('詠唱');
  });

  it('resolves token word data using shared token options', async () => {
    const service = createService() as any;
    const sharedWordData = {
      status: 'young',
      analysisStatus: 'young',
      due: false,
      cardIds: [77]
    };
    const resolveSpy = vi.fn(async () => sharedWordData);
    service._resolveTokenWordData = resolveSpy;

    const resolved = await service._resolveTokenWordData('歌い', {
      allowTermEntriesEnrichment: true
    });
    expect(resolved).toEqual(sharedWordData);
  });

  it('refreshTokenAnalysisFromAnki re-resolves through shared IndexedDB analysis path', async () => {
    const service = createService() as any;
    service._refreshTokenWordDataFromAnki = vi.fn(async () => {});
    service._resolveTokenAnalysisData = vi.fn(
      async () => new Map([['歌い', { status: 'mature', due: false, cardIds: [42] }]])
    );

    const resolved = await service.refreshTokenAnalysisFromAnki('歌い');

    expect(service._refreshTokenWordDataFromAnki).toHaveBeenCalledWith('歌い');
    expect(service._resolveTokenAnalysisData).toHaveBeenCalledWith(['歌い']);
    expect(resolved).toEqual({ status: 'mature', due: false, cardIds: [42] });
  });

  it('hover refresh applies color from shared IndexedDB resolver', async () => {
    const service = createService() as any;
    service._refreshTokenWordDataFromAnki = vi.fn(async () => {});
    service._resolveTokenWordData = vi.fn(async () => ({
      status: 'mature',
      analysisStatus: 'mature',
      due: false,
      cardIds: [1]
    }));

    const span = { style: { cssText: '' } } as unknown as HTMLElement;
    await service._refreshToken('歌い', span);

    expect(service._refreshTokenWordDataFromAnki).toHaveBeenCalledWith('歌い');
    expect(service._resolveTokenWordData).toHaveBeenCalledWith('歌い', {
      allowTermEntriesEnrichment: true
    });
    expect(span.style.cssText).toContain('#16a34a');
  });

  it('hover refresh applies uncollected color when IndexedDB has no token data', async () => {
    const service = createService() as any;
    service._refreshTokenWordDataFromAnki = vi.fn(async () => {});
    service._resolveTokenWordData = vi.fn(async () => undefined);

    const span = { style: { cssText: '' } } as unknown as HTMLElement;
    await service._refreshToken('歌い', span);

    expect(span.style.cssText).toContain('#c355ff');
  });

  it('ignores punctuation tokens during hover refresh', async () => {
    const service = createService() as any;
    service._refreshTokenWordDataFromAnki = vi.fn(async () => {});
    service._resolveTokenWordData = vi.fn(async () => undefined);

    const span = { style: { cssText: '' } } as unknown as HTMLElement;
    await service._refreshToken('。', span);

    expect(service._refreshTokenWordDataFromAnki).not.toHaveBeenCalled();
    expect(service._resolveTokenWordData).not.toHaveBeenCalled();
    expect(span.style.cssText).toContain('currentColor');
  });

  it('attaches mouseenter refresh listeners to token spans', () => {
    const service = createService() as any;
    const container = document.createElement('div');
    const span = document.createElement('span');
    span.setAttribute('data-anki-token', '歌い');
    container.appendChild(span);

    const addEventSpy = vi.spyOn(span, 'addEventListener');

    service._attachHoverListeners(container);

    expect(addEventSpy).toHaveBeenCalledWith('dblclick', expect.any(Function));
    expect(addEventSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
  });

  it('tracks first occurrence index for book-order sorting in token panel', async () => {
    const service = createService() as any;
    service.yomitan = {
      tokenize: vi.fn(async () => ['僕', '歌い', '僕', '最近'])
    };
    service._resolveTokenAnalysisData = vi.fn(
      async (tokens: string[]) =>
        new Map(
          tokens.map((token) => [
            token,
            {
              status: 'mature',
              due: false,
              cardIds: [1]
            }
          ])
        )
    );

    const result = await service.analyzeDocumentText('dummy', {
      chunkSize: 1000,
      scanLength: 1000
    });

    expect(result.entries.map((entry: any) => entry.token)).toEqual(['僕', '歌い', '最近']);
    expect(result.entries.map((entry: any) => entry.firstOccurrence)).toEqual([0, 1, 2]);
  });

  it('reposition order defaults to min occurrences > 1', async () => {
    const service = createService() as any;
    service.yomitan = {
      tokenize: vi.fn(async () => ['alpha', 'beta', 'alpha', 'gamma'])
    };
    service._resolveTokenAnalysisData = vi.fn(
      async () =>
        new Map([
          ['alpha', { status: 'mature', due: false, cardIds: [11] }],
          ['beta', { status: 'mature', due: false, cardIds: [22] }],
          ['gamma', { status: 'mature', due: false, cardIds: [33] }]
        ])
    );

    const result = await service.buildRepositionOrderForNewCards('dummy', {
      chunkSize: 1000,
      scanLength: 1000
    });

    expect(result.orderedCardIds).toEqual([11]);
    expect(result.processedTokens).toBe(4);
    expect(result.uniqueTokens).toBe(3);
  });

  it('reposition order can prioritize highest occurrences first', async () => {
    const service = createService() as any;
    service.yomitan = {
      tokenize: vi.fn(async () => ['beta', 'alpha', 'beta', 'gamma', 'alpha', 'beta'])
    };
    service._resolveTokenAnalysisData = vi.fn(
      async () =>
        new Map([
          ['alpha', { status: 'mature', due: false, cardIds: [11] }],
          ['beta', { status: 'mature', due: false, cardIds: [22] }],
          ['gamma', { status: 'mature', due: false, cardIds: [33] }]
        ])
    );

    const result = await service.buildRepositionOrderForNewCards('dummy', {
      orderMode: 'occurrences',
      minOccurrences: 1,
      chunkSize: 1000,
      scanLength: 1000
    });

    expect(result.orderedCardIds).toEqual([22, 11, 33]);
  });

  it('reposition occurrence sort uses book order as tie-breaker', async () => {
    const service = createService() as any;
    service.yomitan = {
      tokenize: vi.fn(async () => ['alpha', 'beta', 'alpha', 'beta'])
    };
    service._resolveTokenAnalysisData = vi.fn(
      async () =>
        new Map([
          ['alpha', { status: 'mature', due: false, cardIds: [11] }],
          ['beta', { status: 'mature', due: false, cardIds: [22] }]
        ])
    );

    const result = await service.buildRepositionOrderForNewCards('dummy', {
      orderMode: 'occurrences',
      minOccurrences: 1,
      chunkSize: 1000,
      scanLength: 1000
    });

    expect(result.orderedCardIds).toEqual([11, 22]);
  });
});
