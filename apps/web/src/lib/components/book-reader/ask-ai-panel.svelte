<script lang="ts">
  import { faPaperPlane, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
  import AiLanguageToggle from '$lib/components/ai-language-toggle.svelte';
  import { presetsForLanguage } from '$lib/data/ai-prompts';
  import {
    aiLanguage$,
    askAiDefaultPreset$,
    askAiPresets$,
    openRouterApiKey$,
    openRouterModel$,
    type AskAiPreset
  } from '$lib/data/ai-settings';
  import {
    askAi,
    buildPassagePrompt,
    type ChatMessage,
    type PassageContext
  } from '$lib/data/ask-ai';
  import { pagePath } from '$lib/data/env';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { renderBasicMarkdown } from '$lib/functions/basic-markdown';

  export let passage: PassageContext;

  const dispatch = createEventDispatcher<{ close: void }>();

  interface Exchange {
    question: string;
    answer: string;
    error?: string;
  }

  let messages: ChatMessage[] = [];
  let exchanges: Exchange[] = [];
  let question = '';
  let busy = false;
  let abortController = new AbortController();
  let answersElm: HTMLElement;

  $: presets = presetsForLanguage($askAiPresets$, $aiLanguage$);

  onMount(() => {
    const preset = presets.find((p) => p.id === $askAiDefaultPreset$);

    if (preset) {
      runPreset(preset);
    }
  });

  onDestroy(() => abortController.abort());

  function runPreset(preset: AskAiPreset) {
    ask(preset.prompt, preset.label);
  }

  /** `label` is shown instead of a long preset prompt. */
  async function ask(text: string, label = text) {
    if (busy) {
      return;
    }

    const content = messages.length ? text : buildPassagePrompt(passage, text);
    const exchangeIndex = exchanges.length;
    const requestMessages: ChatMessage[] = [...messages, { role: 'user', content }];

    exchanges = [...exchanges, { question: label, answer: '' }];
    question = '';
    busy = true;

    try {
      messages = await askAi(
        requestMessages,
        (answer) => {
          updateExchange(exchangeIndex, { answer });
          answersElm?.scrollTo({ top: answersElm.scrollHeight });
        },
        abortController.signal
      );
    } catch (error) {
      if (!abortController.signal.aborted) {
        updateExchange(exchangeIndex, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      busy = false;
    }
  }

  function updateExchange(index: number, update: Partial<Exchange>) {
    exchanges = exchanges.map((exchange, i) =>
      i === index ? { ...exchange, ...update } : exchange
    );
  }

  function close() {
    abortController.abort();
    dispatch('close');
  }
</script>

<aside
  class="reader-panel writing-horizontal-tb fixed inset-x-0 bottom-0 z-30 flex max-h-[75vh] flex-col rounded-t-xl text-sm shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-none"
  aria-label="Ask AI"
>
  <header class="reader-panel-divider flex items-center gap-2 border-b px-4 py-3">
    <span class="flex-1 font-semibold">Ask AI</span>
    <span class="truncate text-xs opacity-60">{$openRouterModel$}</span>
    <AiLanguageToggle />
    <button class="p-1" title="Close" on:click={close}><Fa icon={faXmark} /></button>
  </header>

  <div class="flex-1 overflow-y-auto px-4 py-3" bind:this={answersElm}>
    <blockquote class="reader-panel-quote mb-3 border-l-2 pl-3 opacity-80" lang="ja">
      {passage.selection}
    </blockquote>
    {#if !$openRouterApiKey$}
      <p class="mb-3">
        Ask AI needs an OpenRouter API key.
        <a
          class="underline"
          href="{pagePath}/settings?section=ai#ai-guide"
          target="_blank"
          rel="noreferrer">Setup guide</a
        >
      </p>
    {/if}
    {#each exchanges as exchange, index (index)}
      {#if exchange.question}
        <p class="mt-4 mb-2 font-semibold">{exchange.question}</p>
      {/if}
      {#if exchange.error}
        <p class="text-panel-danger">{exchange.error}</p>
      {:else if exchange.answer}
        <div class="answer whitespace-pre-wrap leading-relaxed">
          {@html renderBasicMarkdown(exchange.answer)}
        </div>
      {:else}
        <Fa icon={faSpinner} spin />
      {/if}
    {/each}
  </div>

  {#if presets.length}
    <div class="flex flex-wrap gap-1.5 px-4 pb-2" role="group" aria-label="Quick questions">
      {#each presets as preset (preset.id)}
        <button
          type="button"
          class="reader-panel-chip rounded-full px-3 py-1 text-xs font-semibold"
          title={preset.prompt}
          disabled={busy}
          on:click={() => runPreset(preset)}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  {/if}

  <form
    class="reader-panel-divider flex gap-2 border-t px-4 py-3"
    on:submit|preventDefault={() => question.trim() && ask(question.trim())}
  >
    <input
      class="reader-panel-input min-w-0 flex-1 rounded px-3 py-2"
      placeholder={exchanges.length ? 'Ask a follow-up...' : 'Ask about this passage...'}
      bind:value={question}
      disabled={busy}
    />
    <button class="px-2" title="Send" disabled={busy || !question.trim()}>
      <Fa icon={faPaperPlane} />
    </button>
  </form>
</aside>

<style>
  .answer :global(code) {
    padding: 0 0.2rem;
    border-radius: 0.2rem;
    background: color-mix(in srgb, var(--reader-panel-fg) 10%, transparent);
  }
</style>
