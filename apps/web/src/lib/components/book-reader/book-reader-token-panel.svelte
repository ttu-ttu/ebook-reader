<script lang="ts">
  import type {
    DocumentTokenAnalysisEntry,
    DocumentTokenAnalysisProgress,
    DocumentTokenStatus
  } from '$lib/functions/anki';
  import { createEventDispatcher } from 'svelte';

  type FilterId = 'all' | 'due' | DocumentTokenStatus;

  export let loading = false;
  export let progress: DocumentTokenAnalysisProgress | undefined;
  export let entries: DocumentTokenAnalysisEntry[] = [];
  export let totalTokens = 0;
  export let uniqueTokens = 0;
  export let error = '';
  export let activeFilter: FilterId = 'all';
  export let activeToken: string | null = null;
  export let tokenSentences: Record<string, { sentence: string; page: number | null }[]> = {};
  export let sentenceLoadingToken: string | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    filterChange: { filter: FilterId };
    tokenSelect: { token: string };
    tokenHover: { token: string };
    sentenceSelect: { token: string; sentence: string };
  }>();

  const filters: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'uncollected', label: 'Unmined' },
    { id: 'due', label: 'Due' },
    { id: 'new', label: 'New' },
    { id: 'young', label: 'Young' },
    { id: 'mature', label: 'Mature' },
    { id: 'unknown', label: 'Unknown' }
  ];

  $: filteredEntries =
    activeFilter === 'all'
      ? entries
      : activeFilter === 'due'
        ? entries.filter((entry) => entry.due)
        : entries.filter((entry) => entry.status === activeFilter);

  $: counts = {
    all: entries.length,
    uncollected: entries.filter((entry) => entry.status === 'uncollected').length,
    due: entries.filter((entry) => entry.due).length,
    new: entries.filter((entry) => entry.status === 'new').length,
    young: entries.filter((entry) => entry.status === 'young').length,
    mature: entries.filter((entry) => entry.status === 'mature').length,
    unknown: entries.filter((entry) => entry.status === 'unknown').length
  };

  function badgeClass(status: DocumentTokenStatus): string {
    switch (status) {
      case 'mature':
        return 'bg-green-500/15 text-green-200 border-green-400/30';
      case 'young':
        return 'bg-orange-500/15 text-orange-100 border-orange-300/30';
      case 'new':
        return 'bg-cyan-500/15 text-cyan-100 border-cyan-300/30';
      case 'uncollected':
        return 'bg-fuchsia-500/15 text-fuchsia-100 border-fuchsia-300/30';
      default:
        return 'bg-slate-500/15 text-slate-100 border-slate-300/30';
    }
  }

  function onTokenSelect(token: string): void {
    dispatch('tokenSelect', { token });
  }

  function onTokenHover(token: string): void {
    dispatch('tokenHover', { token });
  }

  function onSentenceSelect(token: string, sentence: string): void {
    dispatch('sentenceSelect', { token, sentence });
  }

  function onFilterSelect(filter: FilterId): void {
    if (activeFilter === filter) {
      return;
    }

    activeFilter = filter;
    dispatch('filterChange', { filter });
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getTokenHighlightClass(status: DocumentTokenStatus, due: boolean): string {
    if (due) {
      return 'rounded bg-red-500/25 px-0.5 text-red-100';
    }

    switch (status) {
      case 'mature':
        return 'rounded bg-green-500/25 px-0.5 text-green-100';
      case 'young':
        return 'rounded bg-orange-500/25 px-0.5 text-orange-100';
      case 'new':
        return 'rounded bg-cyan-500/25 px-0.5 text-cyan-100';
      case 'uncollected':
        return 'rounded bg-fuchsia-500/25 px-0.5 text-fuchsia-100';
      default:
        return 'rounded bg-slate-500/25 px-0.5 text-slate-100';
    }
  }

  function highlightTokenInSentence(
    sentence: string,
    token: string,
    status: DocumentTokenStatus,
    due: boolean
  ): string {
    if (!sentence) {
      return '';
    }

    if (!token) {
      return escapeHtml(sentence);
    }

    const tokenPattern = new RegExp(escapeRegExp(token), 'g');
    const tokenHighlightClass = getTokenHighlightClass(status, due);
    let previousIndex = 0;
    let highlighted = '';

    for (const match of sentence.matchAll(tokenPattern)) {
      const startIndex = match.index ?? -1;
      if (startIndex < 0) {
        continue;
      }

      highlighted += escapeHtml(sentence.slice(previousIndex, startIndex));
      highlighted += `<mark class="${tokenHighlightClass}">${escapeHtml(match[0])}</mark>`;
      previousIndex = startIndex + match[0].length;
    }

    if (previousIndex === 0) {
      return escapeHtml(sentence);
    }

    highlighted += escapeHtml(sentence.slice(previousIndex));
    return highlighted;
  }
</script>

<aside
  class="fixed right-4 top-16 z-20 flex h-[calc(100vh-5.5rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-500/20 bg-slate-950/90 text-slate-50 shadow-2xl backdrop-blur"
  style:writing-mode="'horizontal-tb'"
>
  <div class="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
    <div>
      <div class="text-sm font-semibold">Token Panel</div>
      <div class="text-xs text-slate-300">
        {#if loading}
          Analyzing full document
        {:else}
          {filteredEntries.length} shown / {uniqueTokens} unique
        {/if}
      </div>
      {#if !loading}
        <div class="mt-1 text-[11px] text-slate-400">
          `Due` overlaps with `New`, `Young`, and `Mature`.
        </div>
      {/if}
    </div>
    <button
      class="rounded-md border border-slate-600 px-2 py-1 text-sm text-slate-200 hover:border-slate-400"
      on:click={() => dispatch('close')}
    >
      Close
    </button>
  </div>

  {#if loading}
    <div class="border-b border-slate-800 px-4 py-4">
      <div class="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>{progress?.phase === 'resolve' ? 'Resolving statuses' : 'Tokenizing'}</span>
        <span>{progress?.percentage ?? 0}%</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          class="h-full bg-cyan-400 transition-all duration-200"
          style={`width: ${progress?.percentage ?? 0}%`}
        />
      </div>
      <div class="mt-2 text-xs text-slate-400">
        Step {progress?.completedSteps ?? 0} / {progress?.totalSteps ?? 0}
      </div>
    </div>
  {:else if error}
    <div class="border-b border-slate-800 px-4 py-4 text-sm text-red-200">{error}</div>
  {/if}

  <div class="grid grid-cols-2 gap-2 border-b border-slate-800 px-4 py-3 text-xs text-slate-300">
    <div>Total tokens: {totalTokens}</div>
    <div>Unique tokens: {uniqueTokens}</div>
  </div>

  <div class="flex flex-wrap gap-2 border-b border-slate-800 px-4 py-3">
    {#each filters as filter}
      <button
        class={`rounded-full border px-3 py-1 text-xs ${
          activeFilter === filter.id
            ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100'
            : 'border-slate-700 text-slate-300 hover:border-slate-500'
        }`}
        on:click={() => onFilterSelect(filter.id)}
      >
        {filter.label} ({counts[filter.id]})
      </button>
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if !loading && !error && filteredEntries.length === 0}
      <div class="px-4 py-6 text-sm text-slate-400">No tokens for this filter.</div>
    {:else}
      <ul class="divide-y divide-slate-800">
        {#each filteredEntries as entry (entry.token)}
          <li class="px-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <button
                  class={`w-full truncate text-left text-base font-semibold transition ${
                    activeToken === entry.token
                      ? 'text-cyan-200'
                      : 'text-slate-100 hover:text-cyan-100 focus:text-cyan-100'
                  }`}
                  on:mouseenter={() => onTokenHover(entry.token)}
                  on:click={() => onTokenSelect(entry.token)}
                >
                  {entry.token}
                </button>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {entry.count} occurrence{entry.count === 1 ? '' : 's'}
                  {#if entry.due}
                    <span
                      class="rounded-full border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-100"
                    >
                      Due
                    </span>
                  {/if}
                </div>
              </div>
              <span
                class={`shrink-0 rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${badgeClass(
                  entry.status
                )}`}
              >
                {entry.status === 'uncollected' ? 'Unmined' : entry.status}
              </span>
            </div>
            {#if activeToken === entry.token}
              <div class="mt-3 rounded-lg border border-slate-700/70 bg-slate-900/70 p-2">
                <div class="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
                  Sentences in document
                </div>
                {#if sentenceLoadingToken === entry.token}
                  <div class="text-xs text-slate-400">Searching sentences...</div>
                {:else if (tokenSentences[entry.token] || []).length === 0}
                  <div class="text-xs text-slate-400">No sentence found for this token.</div>
                {:else}
                  <ul class="space-y-1">
                    {#each tokenSentences[entry.token] || [] as match}
                      <li>
                        <button
                          class="w-full rounded border border-slate-700/70 bg-slate-800/60 px-2 py-1 text-left text-xs text-slate-100 hover:border-cyan-400/70 hover:text-cyan-100"
                          on:click={() => onSentenceSelect(entry.token, match.sentence)}
                        >
                          <div class="whitespace-normal">
                            {@html highlightTokenInSentence(
                              match.sentence,
                              entry.token,
                              entry.status,
                              entry.due
                            )}
                          </div>
                          {#if match.page}
                            <div class="mt-1 text-[11px] text-cyan-200/90">Page {match.page}</div>
                          {/if}
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</aside>
