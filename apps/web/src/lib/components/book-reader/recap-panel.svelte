<script lang="ts">
  import {
    faChevronDown,
    faChevronRight,
    faSpinner,
    faTrash
  } from '@fortawesome/free-solid-svg-icons';
  import type { Section } from '$lib/data/database/books-db/versions/v3/books-db-v3';
  import {
    deleteSavedRecap,
    getSavedRecaps,
    planRecap,
    recapsChanged$,
    writeRecap,
    type RecapPlan,
    type SavedRecap
  } from '$lib/data/recap';
  import { extrasSyncError$, syncExtras } from '$lib/data/extras-sync';
  import { chapterLabelAt, type SearchIndex } from '$lib/functions/book-text/book-search';
  import { onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { renderBasicMarkdown } from '$lib/functions/basic-markdown';

  export let title: string;
  export let getIndex: () => Promise<SearchIndex>;
  export let sections: Section[];
  export let position: number;
  export let bookCharacters: number;
  /** The tab is showing (it stays mounted while hidden) */
  export let active = true;

  /** A saved recap this close to the position is shown instead of writing a new one. */
  const reuseDistance = 2000;

  let index: SearchIndex | undefined;
  let plan: RecapPlan | undefined;
  let saved: SavedRecap[] = [];
  let openRecap: number | undefined;
  let progress = '';
  let recap = '';
  let error = '';
  let running = false;
  let abortController = new AbortController();

  const percent = (count: number) =>
    bookCharacters ? `${((count / bookCharacters) * 100).toFixed(1)}%` : '';

  // Recaps from other devices arrive through sync.
  const subscription = recapsChanged$.subscribe((changed) => {
    if (changed.title === title) {
      saved = [...(changed.saved ?? [])].sort((a, b) => a.position - b.position);
    }
  });

  onMount(async () => {
    try {
      await syncExtras('recaps', title);
      saved = await getSavedRecaps(title);
      index = await getIndex();
      plan = await planRecap(title, index, sections, position, bookCharacters);

      const recent = [...saved]
        .reverse()
        .find((r) => r.position <= position && position - r.position <= reuseDistance);

      // Show the latest saved recap near here; writing a new one is up to the reader.
      if (recent) {
        openRecap = recent.created;
      }
    } catch (e: any) {
      error = e.message;
    }
  });

  onDestroy(() => {
    abortController.abort();
    subscription.unsubscribe();
  });

  // Follow the position, so a recap written later covers what has been read since.
  $: if (active && index && !running) {
    planRecap(title, index, sections, position, bookCharacters)
      .then((updated) => (plan = updated))
      .catch(() => {});
  }

  async function start() {
    if (!index || !plan || running) {
      return;
    }

    running = true;
    error = '';
    recap = '';
    openRecap = undefined;

    try {
      const written = await writeRecap(
        title,
        index,
        plan,
        position,
        (message) => (progress = message),
        (text) => (recap = text),
        abortController.signal
      );

      progress = '';
      recap = '';
      saved = await getSavedRecaps(title);
      openRecap = written.created;
    } catch (e: any) {
      if (!abortController.signal.aborted) {
        error = e.message;
      }
    } finally {
      running = false;
    }
  }

  async function remove(created: number) {
    await deleteSavedRecap(title, created);
    saved = await getSavedRecaps(title);
  }
</script>

<div class="flex-1 overflow-y-auto px-4 py-3">
  {#if error}
    <p class="mb-3 text-panel-danger">{error}</p>
  {/if}
  {#if $extrasSyncError$.recaps}
    <p class="mb-3 text-xs text-panel-danger">{$extrasSyncError$.recaps}</p>
  {/if}

  {#if !plan && !error}
    <p class="flex items-center gap-2 opacity-80"><Fa icon={faSpinner} spin /> Preparing...</p>
  {:else if plan && !running}
    <p class="mb-3 leading-relaxed">
      A spoiler-free recap up to your position ({position.toLocaleString()} characters, {percent(
        position
      )}). Finished parts are summarised once and cached in this browser; each recap is saved here
      by position.
    </p>
    {#if plan.missing.length}
      <p class="mb-3 text-xs opacity-80">
        {plan.missing.length} part{plan.missing.length === 1 ? '' : 's'} still
        {plan.missing.length === 1 ? 'needs' : 'need'} summarising: about {Math.round(
          plan.missingCharacters / 1000
        )}k characters will be sent to {plan.model}.
      </p>
    {/if}
    <button class="reader-panel-chip mb-4 rounded-full px-4 py-2 font-semibold" on:click={start}>
      Write recap at this position
    </button>
  {/if}

  {#if progress}
    <p class="mb-3 flex items-center gap-2 text-xs opacity-80">
      <Fa icon={faSpinner} spin />
      {progress}
    </p>
  {/if}

  {#if recap}
    <div class="mb-4 whitespace-pre-wrap leading-relaxed">{@html renderBasicMarkdown(recap)}</div>
  {/if}

  {#if saved.length}
    <h3 class="pb-1 pt-2 text-xs font-bold uppercase tracking-wide opacity-60">Saved recaps</h3>
    {#each [...saved].reverse() as item (item.created)}
      {@const ahead = item.position > position}
      <div class="saved rounded-lg">
        <div class="flex items-center gap-2 px-2 py-2">
          <button
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            on:click={() => (openRecap = openRecap === item.created ? undefined : item.created)}
          >
            <Fa icon={openRecap === item.created ? faChevronDown : faChevronRight} fw />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold">
                {chapterLabelAt(sections, item.position) || 'Recap'} · {percent(item.position)}
              </span>
              <span class="block text-xs opacity-60">
                {item.position.toLocaleString()} characters · {new Date(
                  item.created
                ).toLocaleDateString()}{ahead ? ' · ahead of your position' : ''}
              </span>
            </span>
          </button>
          <button
            class="p-1.5 opacity-60 hover:opacity-100"
            title="Delete"
            on:click={() => remove(item.created)}
          >
            <Fa icon={faTrash} />
          </button>
        </div>
        {#if openRecap === item.created}
          <div class="whitespace-pre-wrap px-3 pb-3 leading-relaxed">
            {@html renderBasicMarkdown(item.text)}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .saved:hover {
    background: color-mix(in srgb, var(--reader-panel-fg) 5%, transparent);
  }
</style>
