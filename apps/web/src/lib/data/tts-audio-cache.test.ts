/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TtsAudioCache } from './tts-audio-cache';

describe('TtsAudioCache', () => {
  let nextUrl = 0;
  const revoked: string[] = [];

  URL.createObjectURL = vi.fn(() => `blob:${(nextUrl += 1)}`);
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });

  afterEach(() => {
    revoked.length = 0;
  });

  it('retries a chunk whose request failed', async () => {
    const synthesize = vi
      .fn<(index: number) => Promise<{ audio: Blob }>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ audio: new Blob(['mp3']) });
    const cache = new TtsAudioCache(synthesize);

    await expect(cache.get(0)).rejects.toThrow('network');
    await expect(cache.get(0)).resolves.toMatchObject({ url: expect.stringMatching(/^blob:/) });
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('reuses successful chunks', async () => {
    const synthesize = vi.fn(async () => ({ audio: new Blob(['mp3']) }));
    const cache = new TtsAudioCache(synthesize);

    expect(await cache.get(3)).toBe(await cache.get(3));
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('only keeps chunks around the current one', async () => {
    const cache = new TtsAudioCache(async () => ({ audio: new Blob(['mp3']) }), 1, 2);
    const urls = (await Promise.all([0, 1, 2, 3, 4, 5].map((i) => cache.get(i)))).map(
      (speech) => speech.url
    );

    cache.trim(3);
    await Promise.resolve();

    expect(cache.size).toBe(4); // 2, 3, 4, 5
    expect(revoked.sort()).toEqual([urls[0], urls[1]].sort());

    cache.clear();
    await Promise.resolve();
    expect(cache.size).toBe(0);
    expect(revoked).toHaveLength(6);
  });
});
