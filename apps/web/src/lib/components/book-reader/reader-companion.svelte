<script lang="ts" context="module">
  export type CompanionTab = 'highlights' | 'recap' | 'lorebook';
</script>

<script lang="ts">
  import {
    faBookAtlas,
    faBookOpen,
    faHighlighter,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import AiLanguageToggle from '$lib/components/ai-language-toggle.svelte';
  import AnnotationsPanel from '$lib/components/book-reader/annotations-panel.svelte';
  import LorebookPanel from '$lib/components/book-reader/lorebook-panel.svelte';
  import RecapPanel from '$lib/components/book-reader/recap-panel.svelte';
  import type { Highlight } from '$lib/data/annotations';
  import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';
  import type { SearchIndex } from '$lib/functions/book-text/book-search';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  /**
   * The reader's side panel: highlights, "Story so far" and the lorebook as
   * tabs, instead of separate entries in the More menu. Not part of upstream.
   */
  export let tab: CompanionTab;
  export let title: string;
  export let highlights: Highlight[];
  export let syncError: string;
  export let getIndex: () => Promise<SearchIndex>;
  export let sections: Section[];
  export let position: number;
  export let bookCharacters: number;

  const dispatch = createEventDispatcher<{
    close: void;
    jump: Highlight;
    edit: Highlight;
  }>();

  let visited = new Set<CompanionTab>();

  // A new Set each time: the app compiles with immutable: true, so mutating it wouldn't re-render.
  $: if (!visited.has(tab)) {
    visited = new Set([...visited, tab]);
  }

  const tabs = [
    { key: 'highlights', label: 'Highlights', icon: faHighlighter },
    { key: 'recap', label: 'Story so far', icon: faBookOpen },
    { key: 'lorebook', label: 'Lorebook', icon: faBookAtlas }
  ] as const;
</script>

<aside
  class="reader-panel writing-horizontal-tb fixed inset-x-0 bottom-0 z-[60] flex max-h-[80vh] flex-col rounded-t-xl text-sm shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-none"
  aria-label="Reading companion"
>
  <header class="reader-panel-divider flex items-center gap-1 border-b px-2 py-2" role="tablist">
    {#each tabs as item (item.key)}
      <button
        class="tab flex items-center gap-1.5 rounded-full px-3 py-1.5"
        class:tab-active={tab === item.key}
        role="tab"
        aria-selected={tab === item.key}
        title={item.label}
        on:click={() => (tab = item.key)}
      >
        <Fa icon={item.icon} />
        <!-- Phones: only the active tab is labelled, so the tabs fit beside Close. -->
        <span class={tab === item.key ? '' : 'hidden sm:inline'}>{item.label}</span>
      </button>
    {/each}
    <span class="flex-1" />
    <button class="p-2" title="Close" on:click={() => dispatch('close')}
      ><Fa icon={faXmark} /></button
    >
  </header>

  {#if tab !== 'highlights'}
    <!-- Below the tabs, not beside Close, which it covered on phones. -->
    <div class="flex justify-end px-4 pt-2"><AiLanguageToggle /></div>
  {/if}

  <!-- Visited tabs stay mounted, so a recap being written survives switching tabs. -->
  {#if visited.has('highlights')}
    <div class="tab-panel" class:hidden={tab !== 'highlights'}>
      <AnnotationsPanel {title} {highlights} {syncError} on:jump on:edit />
    </div>
  {/if}
  {#if visited.has('recap')}
    <div class="tab-panel" class:hidden={tab !== 'recap'}>
      <RecapPanel
        {title}
        {getIndex}
        {sections}
        {position}
        {bookCharacters}
        active={tab === 'recap'}
      />
    </div>
  {/if}
  {#if visited.has('lorebook')}
    <div class="tab-panel" class:hidden={tab !== 'lorebook'}>
      <LorebookPanel {title} {getIndex} {position} />
    </div>
  {/if}
</aside>

<style>
  .tab-panel {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .tab-panel.hidden {
    display: none;
  }

  .tab {
    font-weight: 600;
    opacity: 0.65;
    white-space: nowrap;
  }

  .tab-active {
    background: color-mix(in srgb, var(--reader-panel-fg) 14%, transparent);
    opacity: 1;
  }
</style>
