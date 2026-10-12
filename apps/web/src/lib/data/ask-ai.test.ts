/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRouterApiKey$ } from '$lib/data/ai-settings';
import { askAi } from './ask-ai';

function stream(lines: string[]) {
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/event-stream' } });
}

describe('askAi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    openRouterApiKey$.next('');
  });

  it('streams the answer', async () => {
    openRouterApiKey$.next('sk-or-secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        stream([
          ': keep-alive',
          'data: {"choices":[{"delta":{"content":"こん"}}]}',
          'data: {"choices":[{"delta":{"content":"にちは"}}]}',
          'data: [DONE]'
        ])
      )
    );
    const onText = vi.fn();

    const messages = await askAi([{ role: 'user', content: 'q' }], onText);

    expect(messages[1]).toEqual({ role: 'assistant', content: 'こんにちは' });
    expect(onText).toHaveBeenLastCalledWith('こんにちは');
  });

  it('keeps the key out of error messages', async () => {
    openRouterApiKey$.next('sk-or-secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'Bad key sk-or-secret' } }), {
            status: 401
          })
      )
    );

    await expect(askAi([{ role: 'user', content: 'q' }], () => {})).rejects.toThrow(
      /^(?!.*sk-or-secret).*API key/s
    );
  });

  it('keeps the key out of stream errors', async () => {
    openRouterApiKey$.next('sk-or-secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => stream(['data: {"error":{"message":"key sk-or-secret revoked"}}']))
    );

    await expect(askAi([{ role: 'user', content: 'q' }], () => {})).rejects.toThrow(
      /^(?!.*sk-or-secret)/s
    );
  });
});
