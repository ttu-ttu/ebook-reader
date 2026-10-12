/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * "Ask AI" about a passage through OpenRouter's chat completions API, called
 * directly from the browser with the key from Settings → AI. Not part of upstream.
 */

import { aiPrompts } from '$lib/data/ai-prompts';
import {
  askAiReaderNote$,
  openRouterApiKey$,
  openRouterModel$,
  redactSecret
} from '$lib/data/ai-settings';

const apiUrl = 'https://openrouter.ai/api/v1';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PassageContext {
  bookTitle: string;
  before: string;
  selection: string;
  after: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
}

export function buildPassagePrompt(passage: PassageContext, question: string) {
  return `Book: ${passage.bookTitle}

<text_before>
${passage.before}
</text_before>

<selected_passage>
${passage.selection}
</selected_passage>

<text_after>
${passage.after}
</text_after>

${question || aiPrompts().defaultQuestion}`;
}

export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(`${apiUrl}/models`);

  if (!response.ok) {
    throw new Error(`Could not load OpenRouter models (HTTP ${response.status})`);
  }

  const { data } = (await response.json()) as { data: OpenRouterModel[] };

  return data
    .filter((model) => !model.id.endsWith(':batch'))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function throwForResponse(response: Response, apiKey: string): Promise<never> {
  let detail = '';

  try {
    const body = await response.json();
    detail = body?.error?.message || '';
  } catch (_) {
    // no JSON body
  }

  if (response.status === 401) {
    detail = `${detail} - check the OpenRouter API key in Settings → AI`;
  }

  throw new Error(
    redactSecret(`OpenRouter request failed (HTTP ${response.status}) ${detail}`.trim(), apiKey)
  );
}

export interface AskAiOptions {
  /** Model id instead of the one from Settings → AI */
  model?: string;
  /** System prompt instead of the passage helper prompt */
  system?: string;
}

/**
 * Streams an answer, calling onText with the text so far, and returns the
 * conversation including the answer.
 */
export async function askAi(
  messages: ChatMessage[],
  onText: (text: string) => void,
  signal?: AbortSignal,
  options: AskAiOptions = {}
): Promise<ChatMessage[]> {
  const apiKey = openRouterApiKey$.getValue();

  if (!apiKey) {
    throw new Error('Add an OpenRouter API key in Settings → AI first');
  }

  const note = askAiReaderNote$.getValue().trim();
  const system = options.system || (note ? `${aiPrompts().ask}\n\n${note}` : aiPrompts().ask);
  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Chimimouryou'
    },
    body: JSON.stringify({
      model: options.model || openRouterModel$.getValue(),
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages]
    }),
    signal
  });

  if (!response.ok || !response.body) {
    await throwForResponse(response, apiKey);
  }

  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();

  let buffer = '';
  let text = '';

  const handleLine = (line: string) => {
    // Lines starting with ':' are keep-alive comments.
    if (!line.startsWith('data: ')) {
      return;
    }

    const payload = line.slice(6).trim();

    if (payload === '[DONE]') {
      return;
    }

    const chunk = JSON.parse(payload);

    if (chunk.error) {
      throw new Error(redactSecret(`OpenRouter: ${chunk.error.message || 'stream error'}`, apiKey));
    }

    const delta = chunk.choices?.[0]?.delta?.content;

    if (delta) {
      text += delta;
      onText(text);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += value;

    const lines = buffer.split('\n');

    buffer = lines.pop() ?? '';
    lines.forEach(handleLine);
  }

  // The last line may end without a newline.
  handleLine(buffer);

  if (!text) {
    throw new Error('The model returned an empty answer');
  }

  return [...messages, { role: 'assistant', content: text }];
}
