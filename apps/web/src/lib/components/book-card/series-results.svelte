<script lang="ts">
  import { faCheck, faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import { addToHome, homeBookTitles$, type SeriesMatch } from '$lib/data/library-home';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  /** Store search: whole series matching the search, each addable to Home at once. Not part of upstream. */
  export let matches: SeriesMatch[];

  const dispatch = createEventDispatcher<{ showSeries: string }>();

  $: home = new Set($homeBookTitles$);
</script>

{#if matches.length}
  <section class="series app-surface-card" aria-label="Matching series">
    <h2 class="series-heading"><Fa icon={faLayerGroup} /> Series</h2>
    {#each matches as match (match.series)}
      {@const missing = match.books.filter((book) => !home.has(book.title))}
      <div class="series-row">
        <span class="series-covers">
          {#each match.books.slice(0, 3) as book (book.id)}
            <span class="series-cover"
              ><BookCard imagePath={book.imagePath} title={book.title} /></span
            >
          {/each}
        </span>
        <button
          class="series-name"
          title="Show this series"
          on:click={() => dispatch('showSeries', match.series)}
        >
          <span class="block truncate font-bold">{match.series}</span>
          <span class="series-meta">
            {match.books.length} books{#if match.books[0].authors}&nbsp;· {match.books[0]
                .authors}{/if}
          </span>
        </button>
        <button
          class="series-add"
          disabled={!missing.length}
          title={missing.length ? 'Add every book of the series to Home' : 'All on Home'}
          on:click={() => addToHome(missing.map((book) => book.title))}
        >
          <Fa icon={missing.length ? faPlus : faCheck} />
          <span class="hidden sm:inline"
            >{missing.length ? `Add all ${missing.length}` : 'On Home'}</span
          >
        </button>
      </div>
    {/each}
  </section>
{/if}

<style>
  .series {
    margin-bottom: 1rem;
    padding: 0.8rem 0.9rem;
    border-radius: calc(1.15rem * var(--app-radius-scale));
  }

  .series-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
    color: var(--app-muted-fg);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .series-row {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.4rem 0;
  }

  .series-row + .series-row {
    border-top: 1px solid var(--border-color);
  }

  .series-covers {
    display: flex;
    flex-shrink: 0;
  }

  .series-cover {
    width: 2.2rem;
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: calc(0.35rem * var(--app-radius-scale));
  }

  .series-cover + .series-cover {
    margin-left: -1rem;
  }

  .series-name {
    min-width: 0;
    flex: 1;
    text-align: left;
  }

  .series-meta {
    display: block;
    overflow: hidden;
    color: var(--app-muted-fg);
    font-size: 0.75rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .series-add {
    display: inline-flex;
    min-height: 2.2rem;
    flex-shrink: 0;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.8rem;
    border: 1px solid color-mix(in srgb, var(--accent-color) 35%, var(--border-color));
    border-radius: 0.85rem;
    background: color-mix(in srgb, var(--accent-color) 12%, var(--surface-strong-color));
    font-size: 0.82rem;
    font-weight: 700;
  }

  .series-add:disabled {
    opacity: 0.55;
  }
</style>
