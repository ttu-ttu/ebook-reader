/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Anki mining through AnkiConnect, called from the browser: while a book or game is open,
 * notes added to Anki (e.g. by Yomitan) are noticed and get the sentence's audio (AI voice or
 * the audiobook) or, for visual novels, a screenshot and the game's sound. Settings per
 * browser (Settings → Anki). Not part of upstream.
 */

import { writableBooleanLocalStorageSubject } from '$lib/data/internal/writable-boolean-local-storage-subject';
import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';
import { getAudiobook } from '$lib/data/audiobook';
import { matchableText, type MatchedCue } from '$lib/functions/audiobook/subtitles';
import type { SearchIndex } from '$lib/functions/book-text/book-search';

export const ankiEnabled$ = writableBooleanLocalStorageSubject()('ankiEnabled', false);
export const ankiConnectUrl$ = writableStringLocalStorageSubject()(
  'ankiConnectUrl',
  'http://127.0.0.1:8765'
);
export const ankiSentenceField$ = writableStringLocalStorageSubject()(
  'ankiSentenceField',
  'Sentence'
);
export const ankiAudioField$ = writableStringLocalStorageSubject()(
  'ankiAudioField',
  'SentenceAudio'
);
export const ankiPictureField$ = writableStringLocalStorageSubject()('ankiPictureField', 'Picture');
/** Sentence audio for books, from the imported audiobook. */
export const ankiBookAudio$ = writableBooleanLocalStorageSubject()('ankiBookAudio', false);
/** Books without an audiobook get the sentence read by ElevenLabs instead. */
export const ankiBookAiFallback$ = writableBooleanLocalStorageSubject()(
  'ankiBookAiFallback',
  false
);
export const ankiVnScreenshot$ = writableBooleanLocalStorageSubject()('ankiVnScreenshot', true);
export const ankiVnAudio$ = writableBooleanLocalStorageSubject()('ankiVnAudio', true);

export interface AnkiNote {
  noteId: number;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
}

export interface AnkiMedia {
  audio?: Blob | null;
  picture?: Blob | null;
}

export async function ankiInvoke<T>(action: string, params: object = {}): Promise<T> {
  let response: Response;

  try {
    // No Content-Type: a simple request, as Yomitan sends it.
    response = await fetch(ankiConnectUrl$.getValue(), {
      method: 'POST',
      body: JSON.stringify({ action, version: 6, params })
    });
  } catch (_) {
    throw new Error(
      'Anki is not reachable: is it running with AnkiConnect, and is this site allowed?'
    );
  }

  const body = await response.json();

  if (body.error) {
    throw new Error(`AnkiConnect: ${body.error}`);
  }

  return body.result;
}

/**
 * Calls `onNote` for every note added after the first check, until the returned function is
 * called. `onError` gets failed checks (e.g. Anki closed) and `undefined` once they work again.
 */
export function watchAddedNotes(
  onNote: (note: AnkiNote) => Promise<void>,
  onError: (error: Error | undefined) => void,
  interval = 2000
) {
  let latest: number | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  async function check() {
    try {
      // Note ids are their creation times, so newer notes have larger ids.
      const ids = await ankiInvoke<number[]>('findNotes', { query: 'added:1' });
      const added = latest === undefined ? [] : ids.filter((id) => id > latest!);

      latest = Math.max(latest ?? 0, ...ids);
      onError(undefined);

      if (added.length && !stopped) {
        for (const note of await ankiInvoke<AnkiNote[]>('notesInfo', { notes: added })) {
          await onNote(note);
        }
      }
    } catch (error: any) {
      onError(error);
    }

    if (!stopped) {
      timer = setTimeout(check, interval);
    }
  }

  check();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/** The note's sentence (Settings → Anki) as plain text. */
export function noteSentence(note: AnkiNote) {
  const html = note.fields[ankiSentenceField$.getValue().trim()]?.value ?? '';

  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
}

function extension(blob: Blob) {
  const subtype = blob.type.split('/')[1]?.split(';')[0] || 'bin';

  return { mpeg: 'mp3', jpeg: 'jpg' }[subtype] ?? subtype;
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

/**
 * Stores the media in the note's audio and picture fields; fields that are missing or already
 * filled (e.g. by Yomitan) are left alone. Returns the names of the fields filled.
 */
export async function addMediaToNote(note: AnkiNote, media: AnkiMedia) {
  const update: Record<string, unknown> = { id: note.noteId, fields: {} };
  const filled: string[] = [];

  for (const [kind, blob, field] of [
    ['audio', media.audio, ankiAudioField$.getValue().trim()],
    ['picture', media.picture, ankiPictureField$.getValue().trim()]
  ] as const) {
    if (blob?.size && note.fields[field] && !note.fields[field].value.trim()) {
      update[kind] = [
        {
          data: await toBase64(blob),
          filename: `chimimouryou_${note.noteId}_${kind}.${extension(blob)}`,
          fields: [field]
        }
      ];
      filled.push(field);
    }
  }

  if (filled.length) {
    await ankiInvoke('updateNoteFields', { note: update });
  }

  return filled;
}

/**
 * Seconds of the audiobook that read `sentence`: its occurrence nearest the reading position
 * (`bookText` is the book's matchable text, so offsets are character counts) and the matched
 * subtitle lines over it.
 */
export function sentenceClip(
  cues: MatchedCue[],
  bookText: string,
  sentence: string,
  position: number
) {
  const target = matchableText(sentence);
  let best = -1;

  for (
    let at = target ? bookText.indexOf(target) : -1;
    at >= 0;
    at = bookText.indexOf(target, at + 1)
  ) {
    if (best < 0 || Math.abs(at - position) < Math.abs(best - position)) {
      best = at;
    }
  }

  const lines = cues.filter(
    (cue) =>
      best >= 0 && cue.start !== undefined && cue.start < best + target.length && cue.end! > best
  );

  return lines.length
    ? { start: lines[0].startSeconds, end: lines[lines.length - 1].endSeconds }
    : undefined;
}

/** Records `start`-`end` seconds of an audio file, played silently in real time. */
export async function recordClip(audio: Blob, start: number, end: number) {
  const url = URL.createObjectURL(audio);
  const element = new Audio(url);
  const context = new AudioContext();

  try {
    const destination = context.createMediaStreamDestination();

    context.createMediaElementSource(element).connect(destination);
    await new Promise((resolve, reject) => {
      element.onloadedmetadata = resolve;
      element.onerror = () => reject(new Error('Could not play the audiobook'));
    });
    element.currentTime = start;
    await new Promise((resolve) => (element.onseeked = resolve));
    await context.resume();

    const recorder = new MediaRecorder(destination.stream);
    const chunks: Blob[] = [];
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    await element.play();
    // At most 30 s, in case the subtitle times are off.
    await new Promise((resolve) => setTimeout(resolve, Math.min(end - start, 30) * 1000));
    element.pause();
    recorder.stop();
    await stopped;

    return new Blob(chunks, { type: recorder.mimeType });
  } finally {
    context.close();
    URL.revokeObjectURL(url);
  }
}

/** Audio of a sentence mined from a book: the audiobook's, or the AI voice's if allowed. */
export async function bookSentenceAudio(
  title: string,
  sentence: string,
  getIndex: () => Promise<SearchIndex>,
  position: number
) {
  if (!sentence || !ankiBookAudio$.getValue()) {
    return undefined;
  }

  const audiobook = await getAudiobook(title);
  const clip =
    audiobook &&
    sentenceClip(
      audiobook.cues,
      (await getIndex()).paragraphs.map((p) => matchableText(p.text)).join(''),
      sentence,
      position
    );

  if (audiobook && clip) {
    return recordClip(audiobook.audio, clip.start, clip.end);
  }

  // No audiobook, or the sentence isn't in its subtitles: a plugin's (the AI voice).
  // Imported here: the plugins pull in components, which would make an import cycle.
  const { activePlugins } = await import('$lib/plugins');
  const fallback = activePlugins().find((plugin) => plugin.ankiSentenceAudio);

  return ankiBookAiFallback$.getValue() ? fallback?.ankiSentenceAudio?.(sentence) : undefined;
}
