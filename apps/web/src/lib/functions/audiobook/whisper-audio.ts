/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Audio preparation and subtitle output for Whisper running in the browser
 * (whisper.worker.ts). Not part of upstream.
 */

import type { SubtitleCue } from '$lib/functions/audiobook/subtitles';

/** Whisper's input rate. */
export const whisperRate = 16000;

/**
 * Downmixes to mono and resamples to 16 kHz as audio arrives, so hours of audio
 * never sit in memory at once.
 * shortcut: linear interpolation without a low-pass filter; fine for speech
 * recognition, use a proper resampler if transcripts get worse on music-heavy audio.
 */
export class Resampler {
  /** Position of the next output frame, in input frames from the current chunk's start. */
  private next = 0;
  /** Last frame of the previous chunk (frame -1). */
  private previous = 0;

  constructor(private inputRate: number) {}

  /** Planes: one Float32Array per channel, all the same length. */
  push(planes: Float32Array[]) {
    const length = planes[0]?.length ?? 0;
    const mono = new Float32Array(length);

    planes.forEach((plane) => plane.forEach((value, index) => (mono[index] += value)));
    mono.forEach((value, index) => (mono[index] = value / planes.length));

    const step = this.inputRate / whisperRate;
    const output: number[] = [];

    for (; this.next < length - 1; this.next += step) {
      const index = Math.floor(this.next);
      const from = index < 0 ? this.previous : mono[index];

      output.push(from + (mono[index + 1] - from) * (this.next - index));
    }

    if (length) {
      this.next -= length;
      this.previous = mono[length - 1];
    }

    return Float32Array.from(output);
  }
}

export interface WhisperChunk {
  timestamp: [number, number | null];
  text: string;
}

/** Whisper's chunks of one block of audio as cues, `offset` seconds into the audiobook. */
export function chunksToCues(chunks: WhisperChunk[], offset: number, blockSeconds: number) {
  return chunks
    .map(({ timestamp: [start, end], text }, index) => ({
      startSeconds: offset + start,
      // The last chunk of a block may have no end.
      endSeconds: offset + (end ?? chunks[index + 1]?.timestamp[0] ?? blockSeconds),
      text: text.trim()
    }))
    .filter((cue) => cue.text);
}

function srtTime(seconds: number) {
  const ms = Math.round(seconds * 1000);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');

  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(
    Math.floor(ms / 1000) % 60
  )},${pad(ms % 1000, 3)}`;
}

export function cuesToSrt(cues: SubtitleCue[]) {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${srtTime(cue.startSeconds)} --> ${srtTime(cue.endSeconds)}\n${cue.text}\n`
    )
    .join('\n');
}
