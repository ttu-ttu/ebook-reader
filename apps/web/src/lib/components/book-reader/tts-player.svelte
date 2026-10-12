<script lang="ts">
  import {
    faBackwardStep,
    faForwardStep,
    faPause,
    faPlay,
    faSpinner
  } from '@fortawesome/free-solid-svg-icons';
  import {
    defaultElevenLabsModel,
    elevenLabsApiKey$,
    elevenLabsModel$,
    ttsVoiceId$
  } from '$lib/data/ai-settings';
  import {
    readingTimeline,
    synthesizeSpeech,
    timelineEntryAt,
    type TimelineEntry
  } from '$lib/data/tts';
  import { TtsAudioCache } from '$lib/data/tts-audio-cache';
  import {
    buildReadingChunks,
    displayReadingText,
    extractParagraphsFrom,
    speechText,
    type ReadingParagraph
  } from '$lib/functions/tts/extract-reading-text';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  /** Book HTML (furigana is stripped before synthesis) */
  export let elementHtml: string;
  /** Character position to start reading from */
  export let startCharCount: number;

  const dispatch = createEventDispatcher<{
    position: number;
    /** Character counts of the phrase being said */
    reading: { start: number; end: number } | undefined;
  }>();

  const prefetchCount = 2;

  let chunks: ReadingParagraph[] = [];
  let index = 0;
  let playing = false;
  let loading = false;
  let error = !$elevenLabsApiKey$
    ? 'Add an ElevenLabs API key in Settings → AI to read aloud'
    : $ttsVoiceId$
      ? ''
      : 'Set a voice ID in Settings → AI to read aloud';
  let audio: HTMLAudioElement;
  let abortController = new AbortController();
  let audioCache = createAudioCache();

  $: currentText = displayReadingText(chunks[index]?.text ?? '');

  onMount(() => {
    audio = new Audio();
    audio.addEventListener('ended', () => playChunk(index + 1));
    audio.addEventListener('timeupdate', updateReading);
  });

  let timeline: TimelineEntry[] = [];
  let reading: TimelineEntry | undefined;

  /** Highlights the phrase being said, from ElevenLabs' timestamps. */
  function updateReading() {
    const entry = timelineEntryAt(timeline, audio.currentTime);

    if (entry && entry !== reading) {
      reading = entry;
      dispatch('reading', { start: entry.start, end: entry.end });
    }
  }

  onDestroy(stop);

  function createAudioCache() {
    const { signal } = abortController;

    return new TtsAudioCache(
      (chunkIndex) =>
        synthesizeSpeech(speechText(chunks[chunkIndex].text), signal, {
          previousText: chunks[chunkIndex - 1] && speechText(chunks[chunkIndex - 1].text),
          nextText: chunks[chunkIndex + 1] && speechText(chunks[chunkIndex + 1].text)
        }),
      1,
      prefetchCount
    );
  }

  function getAudioUrl(chunkIndex: number) {
    return audioCache.get(chunkIndex);
  }

  async function playChunk(chunkIndex: number) {
    if (chunkIndex >= chunks.length) {
      playing = false;
      return;
    }

    index = chunkIndex;
    loading = true;
    error = '';

    try {
      const { url, alignment } = await getAudioUrl(chunkIndex);

      if (index !== chunkIndex) {
        return;
      }

      audioCache.trim(chunkIndex);

      for (let next = chunkIndex + 1; next <= chunkIndex + prefetchCount; next += 1) {
        if (next < chunks.length) {
          getAudioUrl(next).catch(() => {});
        }
      }

      timeline = readingTimeline(chunks[chunkIndex], alignment);
      reading = undefined;
      audio.src = url;
      await audio.play();
      playing = true;
      dispatch('position', chunks[chunkIndex].startCharCount);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        error = err.message;
        playing = false;
      }
    } finally {
      if (index === chunkIndex) {
        loading = false;
      }
    }
  }

  function resetAudio() {
    abortController.abort();
    abortController = new AbortController();
    audio?.pause();
    audioCache.clear();
    audioCache = createAudioCache();
    playing = false;
    timeline = [];
    reading = undefined;
    dispatch('reading', undefined);
  }

  function start() {
    resetAudio();
    chunks = buildReadingChunks(extractParagraphsFrom(elementHtml, startCharCount));

    if (!chunks.length) {
      error = 'No text found from the current position';
      return;
    }

    playChunk(0);
  }

  function togglePlay() {
    if (!chunks.length) {
      start();
    } else if (playing) {
      audio.pause();
      playing = false;
    } else if (audio.src && !error) {
      // Resume. After an error, the else branch retries the failed chunk instead
      // of replaying the previous one.
      audio.play().then(() => (playing = true));
    } else {
      playChunk(index);
    }
  }

  function skip(offset: number) {
    if (!chunks.length) {
      return;
    }

    audio.pause();
    playChunk(Math.min(Math.max(index + offset, 0), chunks.length - 1));
  }

  function stop() {
    resetAudio();
    chunks = [];
  }
</script>

<!-- One row inside the Listen bar (listen-panel.svelte). -->
<div class="voice">
  <button class="voice-icon" title="Previous" on:click={() => skip(-1)}>
    <Fa icon={faBackwardStep} />
  </button>
  <button
    class="voice-play"
    title={playing ? 'Pause' : 'Read aloud from here'}
    disabled={!$ttsVoiceId$ || !$elevenLabsApiKey$}
    on:click={togglePlay}
  >
    <Fa icon={loading ? faSpinner : playing ? faPause : faPlay} spin={loading} fw />
  </button>
  <button class="voice-icon" title="Next" on:click={() => skip(1)}>
    <Fa icon={faForwardStep} />
  </button>
  <span class="voice-text">
    {#if error}
      <span class="voice-line voice-error">{error}</span>
    {:else}
      <span class="voice-line" lang="ja">{currentText || 'Read aloud from your position'}</span>
    {/if}
    <span class="voice-meta">ElevenLabs · {$elevenLabsModel$ || defaultElevenLabsModel}</span>
  </span>
</div>

<style>
  .voice {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 0.2rem;
  }

  .voice-icon {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    opacity: 0.75;
  }

  .voice-icon:hover {
    background: color-mix(in srgb, var(--reader-panel-fg) 12%, transparent);
    opacity: 1;
  }

  .voice-play {
    display: inline-flex;
    width: 2.4rem;
    height: 2.4rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--accent-color);
    color: var(--app-accent-fg);
  }

  .voice-play:disabled {
    opacity: 0.5;
  }

  .voice-text {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    padding: 0 0.4rem;
    line-height: 1.25;
  }

  .voice-line,
  .voice-meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .voice-error {
    color: var(--app-danger-color);
    font-size: 0.75rem;
  }

  .voice-meta {
    font-size: 0.7rem;
    opacity: 0.55;
  }
</style>
