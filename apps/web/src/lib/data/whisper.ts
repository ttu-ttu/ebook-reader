/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Subtitles for an audiobook made by Whisper in this browser
 * (functions/audiobook/whisper.worker.ts), for the audiobook and Audiobookshelf
 * players. Models come from Hugging Face and stay in the browser's cache. Not part of upstream.
 */

import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';
import type { SubtitleCue } from '$lib/functions/audiobook/subtitles';
import { cuesToSrt } from '$lib/functions/audiobook/whisper-audio';
import { toTimeString } from '$lib/functions/statistic-util';

export const whisperModels = [
  { id: 'onnx-community/whisper-base', name: 'Base (fast, 0.2 GB)' },
  { id: 'onnx-community/whisper-small', name: 'Small (0.4 GB)' },
  { id: 'onnx-community/whisper-large-v3-turbo', name: 'Large v3 Turbo (best, 1.6 GB)' }
];

export const whisperModel$ = writableStringLocalStorageSubject()(
  'whisperModel',
  whisperModels[1].id
);

/** One audio file, `offset` seconds into the audiobook. */
export interface WhisperSource {
  blob?: Blob;
  url?: string;
  offset: number;
}

export interface WhisperRequest {
  model: string;
  sources: WhisperSource[];
}

export type WhisperMessage =
  | { type: 'loading'; progress: number }
  | { type: 'cues'; cues: SubtitleCue[]; seconds: number; duration: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

/**
 * Transcribes the sources and resolves with an SRT; rejects with an AbortError when aborted.
 * shortcut: the work is lost if the tab closes; keep finished blocks in IndexedDB if long books need resuming.
 */
export function transcribeAudio(
  sources: WhisperSource[],
  onProgress: (text: string) => void,
  signal: AbortSignal
) {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(
      new URL('../functions/audiobook/whisper.worker.ts', import.meta.url),
      { type: 'module' }
    );
    const cues: SubtitleCue[] = [];
    const finish = () => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException('Stopped', 'AbortError'));
    };

    signal.addEventListener('abort', abort);
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || 'Whisper could not start'));
    };
    worker.onmessage = ({ data }: MessageEvent<WhisperMessage>) => {
      if (data.type === 'loading') {
        onProgress(`Loading Whisper ${Math.round(data.progress * 100)}%`);
      } else if (data.type === 'cues') {
        cues.push(...data.cues);
        onProgress(`Whisper ${toTimeString(data.seconds)} / ${toTimeString(data.duration)}`);
      } else if (data.type === 'error') {
        finish();
        reject(new Error(data.message));
      } else {
        finish();
        resolve(cuesToSrt(cues));
      }
    };
    worker.postMessage({ model: whisperModel$.getValue(), sources } satisfies WhisperRequest);
  });
}
