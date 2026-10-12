/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * A book's audiobook: the audio file and its subtitle lines matched to the book
 * text, kept in this browser (audio files are too large to sync). Not part of upstream.
 */

import { readerDb } from '$lib/data/reader-db';
import type { MatchedCue } from '$lib/functions/audiobook/subtitles';

export interface BookAudiobook {
  title: string;
  audio: Blob;
  audioName: string;
  subtitleName: string;
  cues: MatchedCue[];
}

export async function getAudiobook(title: string) {
  return (await readerDb()).get('audiobooks', title);
}

export async function putAudiobook(audiobook: BookAudiobook) {
  await (await readerDb()).put('audiobooks', audiobook);
}

// Kept apart from the record so saving it never rewrites the audio blob.
const positionKey = (title: string) => `audiobookPosition:${title}`;

/** Playback position (seconds) and rate. */
export function getAudiobookPosition(title: string): { position: number; rate: number } {
  try {
    return {
      position: 0,
      rate: 1,
      ...JSON.parse(localStorage.getItem(positionKey(title)) || '{}')
    };
  } catch (_) {
    return { position: 0, rate: 1 };
  }
}

export function saveAudiobookPosition(title: string, position: number, rate: number) {
  localStorage.setItem(positionKey(title), JSON.stringify({ position, rate }));
}

export async function deleteAudiobook(title: string) {
  localStorage.removeItem(positionKey(title));
  await (await readerDb()).delete('audiobooks', title);
}
