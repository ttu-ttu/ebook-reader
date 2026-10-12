/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { Speech, SpeechAlignment } from '$lib/data/tts';

export interface CachedSpeech {
  url: string;
  alignment?: SpeechAlignment;
}

/**
 * Synthesized audio for read aloud, as object URLs (with their timestamps) per
 * chunk index. Not part of upstream.
 *
 * Failed requests are not cached, so playing a chunk again retries it. Only a few
 * chunks around the current one are kept (each is about a minute of MP3), so a long
 * listening session doesn't hold every chunk in memory.
 */
export class TtsAudioCache {
  private entries = new Map<number, Promise<CachedSpeech>>();

  constructor(
    private readonly synthesize: (index: number) => Promise<Speech>,
    /** Chunks kept before the current one, e.g. for "Previous" */
    private readonly keepBehind = 1,
    /** Chunks kept after the current one (the prefetched ones) */
    private readonly keepAhead = 2
  ) {}

  get(index: number) {
    let speech = this.entries.get(index);

    if (!speech) {
      const request = this.synthesize(index).then(({ audio, alignment }) => ({
        url: URL.createObjectURL(audio),
        alignment
      }));

      speech = request;
      this.entries.set(index, request);
      request.catch(() => {
        if (this.entries.get(index) === request) {
          this.entries.delete(index);
        }
      });
    }

    return speech;
  }

  /** Releases chunks outside the window around `current`. */
  trim(current: number) {
    this.entries.forEach((speech, index) => {
      if (index < current - this.keepBehind || index > current + this.keepAhead) {
        this.release(index, speech);
      }
    });
  }

  clear() {
    this.entries.forEach((speech, index) => this.release(index, speech));
  }

  get size() {
    return this.entries.size;
  }

  private release(index: number, speech: Promise<CachedSpeech>) {
    this.entries.delete(index);
    speech.then(({ url }) => URL.revokeObjectURL(url)).catch(() => {});
  }
}
