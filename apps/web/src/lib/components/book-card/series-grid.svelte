<script lang="ts">
  import { faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import { addToHome, homeBookTitles$, type SeriesGroup } from '$lib/data/library-home';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  /** Store → Series: one card per series, shown with its first book's cover. Not part of upstream. */
  export let groups: SeriesGroup[];

  const dispatch = createEventDispatcher<{ showSeries: string }>();
  const step = 120;

  let limit = step;

  $: home = new Set($homeBookTitles$);
  $: (groups, (limit = step));
</script>

{#if !groups.length}
  <p class="series-empty">No series match.</p>
{/if}
<div class="series-grid">
  {#each groups.slice(0, limit) as group (group.series)}
    {@const missing = group.books.filter((book) => !home.has(book.title))}
    <div class="series-card">
      <button
        type="button"
        class="series-open"
        title="Show the books of {group.series}"
        on:click={() => dispatch('showSeries', group.series)}
      >
        <span class="series-cover">
          <BookCard imagePath={group.books[0].imagePath} title={group.books[0].title} />
          <span class="series-count">{group.books.length}</span>
        </span>
        <span class="series-name">{group.series}</span>
        <span class="series-meta">
          {group.started ? `${group.started} of ${group.books.length} started` : 'Not started'}
        </span>
      </button>
      <button
        type="button"
        class="series-add"
        disabled={!missing.length}
        title={missing.length ? 'Add every book of the series to Home' : 'All on Home'}
        aria-label={missing.length ? `Add ${group.series} to Home` : `${group.series} is on Home`}
        on:click={() => addToHome(missing.map((book) => book.title))}
      >
        <Fa icon={missing.length ? faPlus : faCheck} />
      </button>
    </div>
  {/each}
</div>
{#if groups.length > limit}
  <div class="flex justify-center py-4">
    <button type="button" class="series-more" on:click={() => (limit += step)}>
      Show more ({groups.length - limit} remaining)
    </button>
  </div>
{/if}

<style>
  .series-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
    gap: 2rem 1.5rem;
    padding-bottom: 1rem;
  }

  .series-card {
    position: relative;
    min-width: 0;
  }

  .series-open {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 0.25rem;
    border-radius: calc(4px * var(--app-radius-scale));
    text-align: left;
  }

  .series-cover {
    position: relative;
    overflow: hidden;
    margin-bottom: 0.4rem;
    border-radius: calc(4px * var(--app-radius-scale));
    /* A second cover peeking out behind: it's a series */
    box-shadow:
      5px -5px 0 -1px var(--surface-strong-color),
      5px -5px 0 0 var(--border-color),
      0 10px 22px -12px var(--app-cover-shadow);
    transition: transform 0.2s var(--app-ease);
  }

  .series-open:hover .series-cover,
  .series-open:focus-visible .series-cover {
    transform: translateY(-3px);
  }

  .series-count {
    position: absolute;
    right: 0.35rem;
    bottom: 0.35rem;
    padding: 0.1rem 0.5rem;
    border-radius: 2px;
    background: var(--surface-strong-color);
    color: var(--font-color);
    font-size: 0.7rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .series-name {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    padding-block: 0.05em;
    font-family: var(--app-font-display);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .series-meta,
  .series-empty {
    color: var(--app-muted-fg);
    font-size: 0.74rem;
  }

  .series-empty {
    padding: 2rem 0;
    text-align: center;
  }

  .series-add {
    position: absolute;
    top: 0.4rem;
    left: 0.4rem;
    display: inline-flex;
    width: 1.8rem;
    height: 1.8rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-strong-color) 92%, transparent);
    color: var(--accent-strong-color);
    font-size: 0.75rem;
  }

  .series-add:disabled {
    opacity: 0.7;
  }

  .series-more {
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--app-control-border);
    border-radius: calc(0.5rem * var(--app-radius-scale));
    font-size: 0.85rem;
    font-weight: 600;
  }
</style>
