/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { addMediaToNote, sentenceClip, watchAddedNotes, type AnkiNote } from '$lib/data/anki';

describe('sentenceClip', () => {
  const cues = [
    { startSeconds: 0, endSeconds: 2, text: '猫がいる。', start: 0, end: 4 },
    { startSeconds: 2, endSeconds: 5, text: '犬もいる。', start: 4, end: 8 },
    { startSeconds: 5, endSeconds: 7, text: '猫がいる。', start: 8, end: 12 }
  ];
  const bookText = '猫がいる犬もいる猫がいる';

  it('takes the occurrence nearest the position', () => {
    expect(sentenceClip(cues, bookText, '猫がいる。', 0)).toEqual({ start: 0, end: 2 });
    expect(sentenceClip(cues, bookText, '猫がいる', 10)).toEqual({ start: 5, end: 7 });
  });

  it('spans every line over the sentence', () => {
    expect(sentenceClip(cues, bookText, 'いる犬もいる', 0)).toEqual({ start: 0, end: 5 });
  });

  it('gives nothing for text not in the book', () => {
    expect(sentenceClip(cues, bookText, '鳥', 0)).toBeUndefined();
    expect(sentenceClip(cues, bookText, '。', 0)).toBeUndefined();
  });
});

describe('AnkiConnect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function stubAnki(handler: (action: string, params: any) => unknown) {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { action, params } = JSON.parse(init.body as string);

      return new Response(JSON.stringify({ result: handler(action, params), error: null }));
    });

    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('reports notes added after the first check only', async () => {
    vi.useFakeTimers();

    let ids = [5];
    const seen: number[] = [];

    stubAnki((action, params) =>
      action === 'findNotes' ? ids : params.notes.map((noteId: number) => ({ noteId, fields: {} }))
    );

    const stop = watchAddedNotes(
      async (note) => {
        seen.push(note.noteId);
      },
      () => {}
    );

    await vi.advanceTimersByTimeAsync(0);
    ids = [5, 7];
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    stop();

    expect(seen).toEqual([7]);
  });

  it('fills only empty fields of the note', async () => {
    const fetchMock = stubAnki(() => null);
    // jsdom's Blob has no arrayBuffer().
    const blob = (text: string, type: string) =>
      ({
        size: text.length,
        type,
        arrayBuffer: async () => new TextEncoder().encode(text).buffer
      }) as Blob;
    const note: AnkiNote = {
      noteId: 1,
      modelName: 'Lapis',
      fields: {
        SentenceAudio: { value: '', order: 0 },
        Picture: { value: '<img src="x.png">', order: 1 }
      }
    };

    const filled = await addMediaToNote(note, {
      audio: blob('a', 'audio/mpeg'),
      picture: blob('p', 'image/webp')
    });

    expect(filled).toEqual(['SentenceAudio']);

    const { params } = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(params.note.audio[0]).toEqual({
      data: btoa('a'),
      filename: 'chimimouryou_1_audio.mp3',
      fields: ['SentenceAudio']
    });
    expect(params.note.picture).toBeUndefined();
  });
});
