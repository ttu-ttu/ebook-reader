<script lang="ts">
  import { faMagnifyingGlass, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
  import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';
  import {
    maxSearchResults,
    searchBook,
    type SearchIndex,
    type SearchResult
  } from '$lib/functions/book-text/book-search';
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import Fa from 'svelte-fa';

  export let getIndex: () => Promise<SearchIndex>;
  export let sections: Section[];
  export let query = '';
  export let ignoreKana = true;
  export let regex = false;
  export let activeIndex = -1;
  export let results: SearchResult[] = [];

  const dispatch = createEventDispatcher<{ close: void; jump: SearchResult }>();
  const renderStep = 100;

  let index: SearchIndex | undefined;
  let error = '';
  let inputElm: HTMLInputElement;
  let listElm: HTMLElement;
  let renderLimit = renderStep;
  let debounce: ReturnType<typeof setTimeout>;

  onMount(async () => {
    inputElm.focus();
    inputElm.select();
    index = await getIndex();
    if (query && !results.length) {
      run();
    }
  });

  $: (query, ignoreKana, regex, schedule());

  function schedule() {
    clearTimeout(debounce);
    debounce = setTimeout(run, 250);
  }

  function run() {
    if (!index) {
      return;
    }

    try {
      results = searchBook(index, query, { ignoreKana, regex }, sections);
      error = '';
    } catch (e: any) {
      results = [];
      error = e instanceof SyntaxError ? `Invalid regular expression: ${e.message}` : e.message;
    }

    activeIndex = -1;
    renderLimit = renderStep;
  }

  async function go(offset: number) {
    if (!results.length) {
      return;
    }

    activeIndex = (activeIndex + offset + results.length) % results.length;
    renderLimit = Math.max(renderLimit, activeIndex + 1);
    dispatch('jump', results[activeIndex]);

    await tick();
    listElm?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      go(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

<aside
  class="reader-panel writing-horizontal-tb fixed inset-x-0 bottom-0 z-[60] flex max-h-[70vh] flex-col rounded-t-xl text-sm shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none"
  aria-label="Search in book"
>
  <header class="reader-panel-divider flex items-center gap-2 border-b px-3 py-2.5">
    <label class="reader-panel-input flex min-w-0 flex-1 items-center gap-2 rounded px-3 py-2">
      <Fa icon={faMagnifyingGlass} class="opacity-60" />
      <input
        class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
        type="search"
        placeholder="Search this book"
        lang="ja"
        bind:this={inputElm}
        bind:value={query}
        on:keydown={onKeydown}
      />
    </label>
    <button class="p-2" title="Close search" on:click={() => dispatch('close')}>
      <Fa icon={faXmark} />
    </button>
  </header>

  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
    <label class="flex items-center gap-1.5">
      <input type="checkbox" bind:checked={ignoreKana} />
      Match hiragana and katakana
    </label>
    <label class="flex items-center gap-1.5">
      <input type="checkbox" bind:checked={regex} />
      Regular expression
    </label>
    <span class="ml-auto flex items-center gap-1 opacity-80">
      {#if !index}
        <Fa icon={faSpinner} spin /> Indexing...
      {:else if query.trim() && !error}
        {#if activeIndex >= 0}{activeIndex + 1} / {/if}{results.length}{results.length >=
        maxSearchResults
          ? '+'
          : ''} results
      {/if}
    </span>
  </div>

  {#if error}
    <p class="px-3 pb-2 text-xs text-panel-danger">{error}</p>
  {/if}

  <ol class="flex-1 overflow-y-auto px-1 pb-3" bind:this={listElm}>
    {#each results.slice(0, renderLimit) as result, i (i)}
      <li>
        <button
          type="button"
          class="search-result w-full rounded-lg px-2 py-2 text-left"
          class:reader-panel-chip-active={i === activeIndex}
          data-active={i === activeIndex}
          on:click={() => {
            activeIndex = i;
            dispatch('jump', result);
          }}
        >
          {#if result.chapter}
            <span class="block truncate text-[0.7rem] opacity-60">{result.chapter}</span>
          {/if}
          <span class="block" lang="ja"
            >{result.before}<mark class="search-mark">{result.match}</mark>{result.after}</span
          >
        </button>
      </li>
    {/each}
    {#if results.length > renderLimit}
      <li class="px-2 pt-2">
        <button class="reader-panel-chip rounded-full px-3 py-1 text-xs" on:click={() => (renderLimit += renderStep)}>
          Show more ({results.length - renderLimit} remaining)
        </button>
      </li>
    {/if}
  </ol>

  {#if results.length}
    <footer class="reader-panel-divider flex justify-end gap-2 border-t px-3 py-2">
      <button class="reader-panel-chip rounded-full px-3 py-1 text-xs" on:click={() => go(-1)}>
        Previous
      </button>
      <button class="reader-panel-chip rounded-full px-3 py-1 text-xs" on:click={() => go(1)}>
        Next
      </button>
    </footer>
  {/if}
</aside>

<style>
  .search-result:hover {
    background: color-mix(in srgb, var(--reader-panel-fg) 8%, transparent);
  }

  .search-mark {
    border-radius: 0.2rem;
    background: var(--search-match-color);
    color: inherit;
  }
</style>
