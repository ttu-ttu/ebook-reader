/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { parseSubtitles } from './subtitles';
import { chunksToCues, cuesToSrt, Resampler } from './whisper-audio';

describe('whisper audio', () => {
  it('downmixes and resamples to 16 kHz across chunks', () => {
    const resampler = new Resampler(48000);
    // A ramp split into uneven chunks; left and right average to the ramp.
    const ramp = Array.from({ length: 4800 }, (_, index) => index);
    const output = [ramp.slice(0, 1000), ramp.slice(1000, 1001), ramp.slice(1001)].flatMap(
      (part) => [
        ...resampler.push([
          Float32Array.from(part, (value) => value - 1),
          Float32Array.from(part, (value) => value + 1)
        ])
      ]
    );

    expect(output.length).toBeGreaterThanOrEqual(1599);
    expect(output.length).toBeLessThanOrEqual(1600);
    output.forEach((value, index) => expect(value).toBeCloseTo(index * 3));
  });

  it('turns chunks into cues and an SRT the reader can parse', () => {
    const cues = chunksToCues(
      [
        { timestamp: [0, 2.5], text: ' 吾輩は猫である。' },
        { timestamp: [2.5, 3], text: ' ' },
        { timestamp: [3, null], text: '名前はまだ無い。' }
      ],
      3600,
      300
    );

    expect(cues).toEqual([
      { startSeconds: 3600, endSeconds: 3602.5, text: '吾輩は猫である。' },
      { startSeconds: 3603, endSeconds: 3900, text: '名前はまだ無い。' }
    ]);
    expect(cuesToSrt(cues)).toContain('01:00:00,000 --> 01:00:02,500');
    expect(parseSubtitles(cuesToSrt(cues))).toEqual(cues);
  });
});
