/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Settings for text-to-speech and "Ask AI", stored per browser. Not part of upstream.
 */

import { writableNumberLocalStorageSubject } from '$lib/data/internal/writable-number-local-storage-subject';
import { writableObjectLocalStorageSubject } from '$lib/data/internal/writable-object-local-storage-subject';
import { writableStringLocalStorageSubject } from '$lib/data/internal/writable-string-local-storage-subject';

/** ElevenLabs' API, called directly from the browser (it allows cross-origin requests). */
export const elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';
export const defaultElevenLabsModel = 'eleven_v4';

/** Removes an API key from text that may be shown or logged (e.g. an echoed error). */
export function redactSecret(text: string, secret: string) {
  return secret ? text.split(secret).join('[API key]') : text;
}

export const elevenLabsApiKey$ = writableStringLocalStorageSubject()('elevenLabsApiKey', '');
export const elevenLabsModel$ = writableStringLocalStorageSubject()(
  'elevenLabsModel',
  defaultElevenLabsModel
);
export const ttsVoiceId$ = writableStringLocalStorageSubject()('ttsVoiceId', '');

export const defaultOpenRouterModel = 'anthropic/claude-opus-5.5';

export const openRouterApiKey$ = writableStringLocalStorageSubject()('openRouterApiKey', '');
export const openRouterModel$ = writableStringLocalStorageSubject()(
  'openRouterModel',
  defaultOpenRouterModel
);

/** Optional cheaper model for "Story so far" recaps; empty means the Ask AI model. */
export const openRouterRecapModel$ = writableStringLocalStorageSubject()(
  'openRouterRecapModel',
  ''
);

/** Language of the AI prompts and answers (Ask AI, recaps, lorebook): 'en' or 'ja'. */
export const aiLanguage$ = writableStringLocalStorageSubject()('aiLanguage', 'en');

/** Update the lorebook in the background every this many characters read; 0 is off. */
export const lorebookAutoInterval$ = writableNumberLocalStorageSubject()('lorebookAutoInterval', 0);

export interface AskAiPreset {
  id: string;
  label: string;
  prompt: string;
}

export const defaultAskAiPresets: AskAiPreset[] = [
  {
    id: 'explain',
    label: 'Explain',
    prompt: 'What does the selected passage mean, and what might I have missed?'
  },
  {
    id: 'translate',
    label: 'Translate',
    prompt:
      'Translate the selected passage into natural English. Then give a closer, more literal rendering and point out where the two differ.'
  },
  {
    id: 'grammar',
    label: 'Grammar',
    prompt:
      'Break down the grammar of the selected passage step by step: conjugations, particles, auxiliary verbs and sentence structure. Name each grammar point and explain what it adds.'
  },
  {
    id: 'kanji',
    label: 'Kanji',
    prompt:
      'Go through the kanji words in the selected passage. For each, give the reading, the meaning in this context, and the meaning of each kanji. Point out any unusual readings.'
  },
  {
    id: 'vocabulary',
    label: 'Vocabulary',
    prompt:
      'List the words in the selected passage a learner might not know, as "word (reading): meaning in this context", one per line. Mark literary, archaic or slang words.'
  },
  {
    id: 'nuance',
    label: 'Nuance',
    prompt:
      'Explain the tone, register and nuance of the selected passage: who is speaking and how (polite, rough, feminine, dialect...), and what it says about the character or situation.'
  }
];

export const askAiPresets$ = writableObjectLocalStorageSubject<AskAiPreset[]>()(
  'askAiPresets',
  defaultAskAiPresets
);

/** Preset run as soon as the panel opens; empty waits for a choice. */
export const askAiDefaultPreset$ = writableStringLocalStorageSubject()(
  'askAiDefaultPreset',
  'explain'
);
