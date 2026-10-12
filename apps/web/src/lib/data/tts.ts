/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Text-to-speech with ElevenLabs' API (with timestamps), called directly from the
 * browser with the key from Settings → AI. The per-character timestamps let the
 * reader highlight what is being said. Not part of upstream.
 */

import {
  elevenLabsApiKey$,
  elevenLabsApiUrl,
  elevenLabsModel$,
  defaultElevenLabsModel,
  redactSecret,
  ttsVoiceId$
} from '$lib/data/ai-settings';
import { speechText, type ReadingParagraph } from '$lib/functions/tts/extract-reading-text';
import { countTextCharacters } from '$lib/functions/get-character-count';

export interface SpeechAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface Speech {
  audio: Blob;
  alignment?: SpeechAlignment;
}

function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type });
}

/** `previousText`/`nextText` let the voice keep its intonation across chunks; they aren't read. */
export async function synthesizeSpeech(
  text: string,
  signal?: AbortSignal,
  context: { previousText?: string; nextText?: string } = {}
): Promise<Speech> {
  const apiKey = elevenLabsApiKey$.getValue();
  const voice = ttsVoiceId$.getValue();

  if (!apiKey) {
    throw new Error('Add an ElevenLabs API key in Settings → AI first');
  }
  if (!voice) {
    throw new Error('Set a voice ID in Settings → AI first');
  }

  const response = await fetch(
    `${elevenLabsApiUrl}/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text,
        model_id: elevenLabsModel$.getValue().trim() || defaultElevenLabsModel,
        ...(context.previousText && { previous_text: context.previousText }),
        ...(context.nextText && { next_text: context.nextText })
      }),
      signal
    }
  );

  if (!response.ok) {
    let detail = '';

    try {
      const body = await response.json();
      const message = body?.detail?.message ?? body?.detail;

      detail = typeof message === 'string' ? message : JSON.stringify(body);
    } catch (_) {
      // no JSON body
    }

    if (response.status === 401 || response.status === 403) {
      detail = `${detail} - check the ElevenLabs API key in Settings → AI`;
    }

    throw new Error(
      redactSecret(`ElevenLabs request failed (HTTP ${response.status}) ${detail}`.trim(), apiKey)
    );
  }

  const body = (await response.json()) as { audio_base64: string; alignment?: SpeechAlignment };

  return { audio: base64ToBlob(body.audio_base64, 'audio/mpeg'), alignment: body.alignment };
}

export interface TimelineEntry {
  /** Seconds into the chunk's audio */
  time: number;
  /** Character counts (as bookmarks) of the phrase */
  start: number;
  end: number;
}

/**
 * Phrases of a chunk (split after 。！？、 and closing quotes) with the time each
 * starts in the audio, from ElevenLabs' character timestamps. Without usable
 * timestamps the whole chunk is one entry.
 */
export function readingTimeline(chunk: ReadingParagraph, alignment?: SpeechAlignment) {
  const whole: TimelineEntry[] = [
    {
      time: 0,
      start: chunk.startCharCount,
      end: chunk.startCharCount + countTextCharacters(chunk.text)
    }
  ];

  if (!alignment?.characters.length) {
    return whole;
  }

  // Text offset of each timed character, so phrases can be looked up by offset.
  const offsets: number[] = [];
  let offset = 0;

  alignment.characters.forEach((character) => {
    offsets.push(offset);
    offset += character.length;
  });

  if (offset !== speechText(chunk.text).length) {
    return whole;
  }

  // Phrases are found in the chunk text; the voice read its speech text.
  const timeAt = (textOffset: number) => {
    const spokenOffset = speechText(chunk.text.slice(0, textOffset)).length;
    const index = offsets.findIndex((o) => o >= spokenOffset);

    return alignment.character_start_times_seconds[index < 0 ? offsets.length - 1 : index] ?? 0;
  };
  const timeline: TimelineEntry[] = [];
  let count = chunk.startCharCount;

  for (const match of chunk.text.matchAll(/[^。！？!?、\n]+[。！？!?、」』）]*|\n/g)) {
    const counted = countTextCharacters(match[0]);

    if (counted) {
      timeline.push({ time: timeAt(match.index ?? 0), start: count, end: count + counted });
    }
    count += counted;
  }

  return timeline.length ? timeline : whole;
}

/** The entry being spoken at `seconds`. */
export function timelineEntryAt(timeline: TimelineEntry[], seconds: number) {
  let current = timeline[0];

  for (const entry of timeline) {
    if (entry.time > seconds) {
      break;
    }
    current = entry;
  }

  return current;
}
