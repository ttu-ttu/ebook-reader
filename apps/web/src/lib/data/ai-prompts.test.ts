/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiLanguage$, defaultAskAiPresets, openRouterApiKey$ } from '$lib/data/ai-settings';
import { askAi, buildPassagePrompt } from '$lib/data/ask-ai';
import { aiPrompts, defaultAskAiPresetsJa, presetsForLanguage } from './ai-prompts';

describe('AI language', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    aiLanguage$.next('en');
    openRouterApiKey$.next('');
  });

  it('switches every prompt with one setting', () => {
    expect(aiPrompts().recap).toContain('Story so far');
    aiLanguage$.next('ja');
    expect(aiPrompts().recap).toContain('これまでのあらすじ');
    expect(aiPrompts().lore).toContain('"category"');
    expect(
      buildPassagePrompt({ bookTitle: 'B', before: '', selection: 's', after: '' }, '')
    ).toContain('選んだ部分はどういう意味');
  });

  it('sends the Japanese system prompt to the model', async () => {
    aiLanguage$.next('ja');
    openRouterApiKey$.next('sk-or-test');
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response('data: {"choices":[{"delta":{"content":"はい"}}]}\n')
    );

    vi.stubGlobal('fetch', fetchMock);
    await askAi([{ role: 'user', content: 'q' }], () => {});

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).messages[0].content).toContain(
      '日本語で簡潔に答え'
    );
  });

  it('shows Japanese default presets unless they were customised', () => {
    expect(presetsForLanguage(defaultAskAiPresets, 'ja')).toBe(defaultAskAiPresetsJa);
    expect(presetsForLanguage(defaultAskAiPresets, 'en')).toBe(defaultAskAiPresets);

    const custom = [{ id: 'mine', label: 'Mine', prompt: 'p' }];

    expect(presetsForLanguage(custom, 'ja')).toBe(custom);
    expect(defaultAskAiPresetsJa.map((p) => p.id)).toEqual(defaultAskAiPresets.map((p) => p.id));
  });
});
