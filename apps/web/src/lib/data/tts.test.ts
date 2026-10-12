/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elevenLabsApiKey$, elevenLabsModel$, ttsVoiceId$ } from '$lib/data/ai-settings';
import { readingTimeline, synthesizeSpeech, timelineEntryAt } from './tts';

function timed(text: string, seconds: number[]) {
  const characters = Array.from(text);

  return {
    characters,
    character_start_times_seconds: seconds,
    character_end_times_seconds: seconds.map((s) => s + 0.1)
  };
}

describe('synthesizeSpeech', () => {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ audio_base64: btoa('mp3'), alignment: timed('テ', [0]) }))
  );

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    ttsVoiceId$.next('voice');
    elevenLabsModel$.next('eleven_v4');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    elevenLabsApiKey$.next('');
  });

  it('calls ElevenLabs with timestamps, the key header and the model', async () => {
    elevenLabsApiKey$.next('sk_secret');

    const speech = await synthesizeSpeech('テスト', undefined, { previousText: '前' });
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voice/with-timestamps?output_format=mp3_44100_128'
    );
    expect((init!.headers as Record<string, string>)['xi-api-key']).toBe('sk_secret');
    expect(JSON.parse(init!.body as string)).toEqual({
      text: 'テスト',
      model_id: 'eleven_v4',
      previous_text: '前'
    });
    expect([speech.audio.size, speech.audio.type]).toEqual([3, 'audio/mpeg']);
    expect(speech.alignment?.characters).toEqual(['テ']);
  });

  it('needs a key', async () => {
    await expect(synthesizeSpeech('テスト')).rejects.toThrow(/API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the key out of error messages', async () => {
    elevenLabsApiKey$.next('sk_secret');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: { message: 'Invalid key sk_secret' } }), {
        status: 401
      })
    );

    await expect(synthesizeSpeech('テスト')).rejects.toThrow(/^(?!.*sk_secret).*API key/s);
  });
});

describe('readingTimeline', () => {
  it('times phrases against the spoken katakana readings', async () => {
    const { extractParagraphsFrom, speechText } = await import(
      '$lib/functions/tts/extract-reading-text'
    );
    const [chunk] = extractParagraphsFrom('<p><ruby>魔法<rt>マジック</rt></ruby>、次。</p>', 0);
    const spoken = speechText(chunk.text);
    const timeline = readingTimeline(chunk, timed(spoken, [0, 0.1, 0.2, 0.3, 0.4, 1, 1.1]));

    expect(timeline).toEqual([
      { time: 0, start: 0, end: 2 },
      { time: 1, start: 2, end: 3 }
    ]);
  });

  it('times each phrase from the character timestamps', () => {
    const text = 'はい、そう。\n次だ。';
    const timeline = readingTimeline(
      { text, startCharCount: 100 },
      timed(text, [0, 0.2, 0.4, 0.6, 0.8, 1, 1.1, 1.5, 1.7, 1.9])
    );

    expect(timeline).toEqual([
      { time: 0, start: 100, end: 102 },
      { time: 0.6, start: 102, end: 104 },
      { time: 1.5, start: 104, end: 106 }
    ]);
    expect(timelineEntryAt(timeline, 0.7)).toBe(timeline[1]);
    expect(timelineEntryAt(timeline, 9)).toBe(timeline[2]);
  });

  it('falls back to the whole chunk without matching timestamps', () => {
    const chunk = { text: 'はい、そう。', startCharCount: 5 };

    expect(readingTimeline(chunk)).toEqual([{ time: 0, start: 5, end: 9 }]);
    expect(readingTimeline(chunk, timed('違う', [0, 1]))).toEqual([{ time: 0, start: 5, end: 9 }]);
  });
});
