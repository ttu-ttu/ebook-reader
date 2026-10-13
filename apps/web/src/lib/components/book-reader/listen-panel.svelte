<script lang="ts" context="module">
  /** Height of the bar plus its gap; the reader leaves this much room above the footer. */
  export const listenBarRem = 4;
</script>

<script lang="ts">
  import { faCompactDisc, faXmark } from '@fortawesome/free-solid-svg-icons';
  import AudiobookPlayer from '$lib/components/book-reader/audiobook-player.svelte';
  import { getAudiobook, type BookAudiobook } from '$lib/data/audiobook';
  import { activePlugins$ } from '$lib/plugins';
  import type { SearchIndex } from '$lib/functions/book-text/book-search';
  import { createEventDispatcher, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  export let title: string;
  export let elementHtml: string;
  export let getIndex: () => Promise<SearchIndex>;
  /** Current reading position */
  export let position: number;
  /** Position when the panel opened, where the voice starts */
  export let startCharCount: number;

  const dispatch = createEventDispatcher<{
    reading: { start: number; end: number } | undefined;
    /** Follow the voice (only forwards) */
    position: number;
    /** Go to a line the user picked */
    jump: number;
    close: void;
  }>();

  let loaded = false;
  let audiobook: BookAudiobook | undefined;
  /** 'audiobook' or a plugin's listen mode key */
  let mode = 'audiobook';

  $: pluginModes = $activePlugins$.flatMap((plugin) => plugin.listenModes ?? []);
  $: pluginMode = pluginModes.find((item) => item.key === mode);

  onMount(async () => {
    try {
      audiobook = await getAudiobook(title);
    } catch (_) {
      // No stored audiobook
    }
    mode = audiobook ? 'audiobook' : (pluginModes[0]?.key ?? 'audiobook');
    loaded = true;
  });

  function setMode(value: string) {
    mode = value;
    dispatch('reading', undefined);
  }
</script>

<!-- A single fixed-height row above the footer; the reader is shortened by listenBarRem so no text sits under it. -->
<div class="listen-bar reader-panel writing-horizontal-tb" role="region" aria-label="Listen">
  {#if loaded}
    {#if pluginMode}
      <svelte:component
        this={pluginMode.component}
        {...pluginMode.props({ title, elementHtml, getIndex, position, startCharCount })}
        on:position
        on:reading
        on:jump
      />
    {:else}
      <AudiobookPlayer
        {title}
        {audiobook}
        {getIndex}
        {position}
        on:reading
        on:jump
        on:changed={({ detail }) => (audiobook = detail)}
      />
    {/if}
  {:else}
    <span class="flex-1" />
  {/if}

  {#if pluginModes.length}
    <div class="listen-modes" role="radiogroup" aria-label="Source">
      {#each [{ key: 'audiobook', title: 'Audiobook', icon: faCompactDisc }, ...pluginModes] as item (item.key)}
        <button
          role="radio"
          aria-checked={mode === item.key}
          class:listen-mode-active={mode === item.key}
          title={item.title}
          on:click={() => setMode(item.key)}
        >
          <Fa icon={item.icon} />
        </button>
      {/each}
    </div>
  {/if}
  <button class="listen-icon" title="Close" on:click={() => dispatch('close')}>
    <Fa icon={faXmark} />
  </button>
</div>

<style>
  .listen-bar {
    position: fixed;
    right: 0.5rem;
    bottom: 2rem;
    left: 0.5rem;
    z-index: 20;
    display: flex;
    height: 3.5rem;
    max-width: 44rem;
    align-items: center;
    gap: 0.25rem;
    margin: 0 auto;
    padding: 0 0.4rem 0 0.5rem;
    border: 1px solid color-mix(in srgb, var(--reader-panel-fg) 10%, transparent);
    border-radius: 1.1rem;
    box-shadow: 0 10px 30px -12px var(--shadow-color);
    font-size: 0.875rem;
    backdrop-filter: blur(12px);
  }

  .listen-modes {
    display: flex;
    flex-shrink: 0;
    padding: 0.15rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--reader-panel-fg) 8%, transparent);
  }

  .listen-modes button {
    display: inline-flex;
    width: 1.9rem;
    height: 1.7rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 0.8rem;
    opacity: 0.55;
  }

  .listen-modes .listen-mode-active {
    background: color-mix(in srgb, var(--reader-panel-fg) 18%, transparent);
    opacity: 1;
  }

  .listen-icon {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    opacity: 0.7;
  }

  .listen-icon:hover {
    opacity: 1;
  }
</style>
