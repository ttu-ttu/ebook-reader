<script lang="ts">
  import type {
    DocumentTokenAnalysisEntry,
    DocumentTokenAnalysisProgress,
    DocumentTokenStatus
  } from '$lib/functions/anki';
  import { createEventDispatcher } from 'svelte';

  export let loading = false;
  export let progress: DocumentTokenAnalysisProgress | undefined;
  export let entries: DocumentTokenAnalysisEntry[] = [];
  export let totalTokens = 0;
  export let uniqueTokens = 0;
  export let error = '';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  type FilterId = 'all' | 'due' | DocumentTokenStatus;

  let activeFilter: FilterId = 'all';

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
        on:click={() => (activeFilter = filter.id)}
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
                <div class="truncate text-base font-semibold">{entry.token}</div>
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
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</aside>
