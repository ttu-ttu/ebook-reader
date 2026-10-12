<script lang="ts">
  import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import DifficultyBadge from '$lib/components/book-card/difficulty-badge.svelte';
  import { isFinished, isReading } from '$lib/components/book-card/library-filters';
  import { formatSeries } from '$lib/components/book-card/library-sort';
  import { longPress } from '$lib/functions/use-long-press';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let bookCards: BookCardProps[] = [];
  export let currentBookId: number | undefined;
  export let selectedBookIds: ReadonlySet<number>;
  export let selectMode = false;
  export let compact = false;

  const dispatch = createEventDispatcher<{
    bookClick: {
      id: number;
    };
    /** Long press: select the book */
    bookSelect: { id: number };
    removeBookClick: {
      id: number;
    };
  }>();
</script>

<div class="library-grid" class:library-grid-compact={compact}>
  {#each bookCards as bookCard (bookCard.id)}
    {@const selected = selectedBookIds.has(bookCard.id)}
    {@const percent = Math.round((bookCard.progress || 0) * 100)}
    <div
      class="library-card"
      class:library-card-current={bookCard.id === currentBookId}
      class:library-card-selected={selected}
      class:opacity-60={bookCard.isPlaceholder}
    >
      <button
        type="button"
        class="library-card-main"
        title={bookCard.title}
        aria-pressed={selectMode ? selected : undefined}
        on:click={() => dispatch('bookClick', { id: bookCard.id })}
        use:longPress={() => dispatch('bookSelect', { id: bookCard.id })}
      >
        <span class="library-card-cover">
          <BookCard imagePath={bookCard.imagePath} title={bookCard.title} />
          {#if isFinished(bookCard)}
            <span class="library-card-seal" title="Finished">読了</span>
          {/if}
          {#if compact && isReading(bookCard)}
            <span class="library-card-compact-progress" style:width="{percent}%" />
          {/if}
        </span>
        {#if !compact}
          <span class="library-card-body">
            <span class="library-card-title" lang="ja">{bookCard.title}</span>
            <!-- Calibre's placeholder author is noise under every card -->
            {#if bookCard.authors && bookCard.authors !== 'Unknown'}
              <span class="library-card-author" lang="ja">{bookCard.authors}</span>
            {/if}
            {#if bookCard.series || bookCard.difficulty !== undefined}
              <span class="library-card-meta">
                {#if bookCard.difficulty !== undefined}
                  <DifficultyBadge
                    difficulty={bookCard.difficulty}
                    low={bookCard.difficultyLow}
                    high={bookCard.difficultyHigh}
                    words95={bookCard.words95}
                    compact
                  />
                {/if}
                {#if bookCard.series}
                  <span class="library-card-series" title="Series: {formatSeries(bookCard)}"
                    >{formatSeries(bookCard)}</span
                  >
                {/if}
              </span>
            {/if}
            {#if isReading(bookCard)}
              <span class="library-card-progress" title="{percent}% read">
                <span class="library-card-progress-track">
                  <span class="library-card-progress-fill" style:width="{percent}%" />
                </span>
                <span class="library-card-progress-label">{percent}%</span>
              </span>
            {/if}
          </span>
        {/if}
      </button>

      {#if selected}
        <span class="library-card-check" aria-hidden="true"><Fa icon={faCheck} /></span>
      {/if}

      {#if !selectMode}
        <button
          type="button"
          class="library-card-remove"
          title="Delete book"
          aria-label="Delete {bookCard.title}"
          on:click={() => dispatch('removeBookClick', { id: bookCard.id })}
        >
          <Fa icon={faXmark} />
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
    gap: 2rem 1.5rem;
    padding-bottom: 1rem;
  }

  .library-grid-compact {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 7rem), 1fr));
    gap: 1.25rem 1rem;
  }

  @media (max-width: 639px) {
    .library-grid {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 7.25rem), 1fr));
      gap: 1.5rem 0.9rem;
    }

    .library-grid-compact {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 5.5rem), 1fr));
    }
  }

  .library-card {
    position: relative;
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .library-card-main {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.65rem;
    border-radius: calc(4px * var(--app-radius-scale));
    text-align: left;
  }

  .library-card-main:focus-visible {
    outline: 2px solid var(--app-focus-ring);
    outline-offset: 4px;
  }

  .library-card-cover {
    position: relative;
    display: block;
    overflow: hidden;
    border-radius: calc(4px * var(--app-radius-scale));
    box-shadow:
      0 1px 2px var(--app-cover-shadow),
      0 10px 22px -12px var(--app-cover-shadow);
    transition:
      box-shadow 0.2s var(--app-ease),
      transform 0.2s var(--app-ease);
  }

  .library-card-main:hover .library-card-cover {
    box-shadow:
      0 2px 4px var(--app-cover-shadow),
      0 16px 30px -14px var(--app-cover-shadow);
    transform: translateY(-3px);
  }

  .library-card-current .library-card-cover,
  .library-card-selected .library-card-cover {
    outline: 2px solid var(--accent-color);
    outline-offset: 3px;
  }

  .library-card-seal {
    position: absolute;
    right: 0.4rem;
    bottom: 0.4rem;
    padding: 0.15rem 0.2rem;
    border: 1.5px solid var(--accent-color);
    border-radius: 2px;
    background: color-mix(in srgb, var(--surface-strong-color) 88%, transparent);
    color: var(--accent-strong-color);
    font-family: var(--app-font-display);
    font-size: 0.62rem;
    line-height: 1.1;
    writing-mode: vertical-rl;
    transform: rotate(-4deg);
  }

  .library-card-body {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
  }

  .library-card-title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    /* Room for CJK glyphs so the clamp never cuts them */
    padding-block: 0.05em;
    font-family: var(--app-font-display);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .library-card-author,
  .library-card-series {
    overflow: hidden;
    color: var(--app-muted-fg);
    font-size: 0.74rem;
    line-height: 1.5;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-card-meta {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.15rem;
  }

  .library-card-series {
    min-width: 0;
    color: var(--app-text-subtle);
  }

  .library-card-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.3rem;
  }

  .library-card-progress-track {
    position: relative;
    flex: 1;
    height: 3px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--app-progress-track);
  }

  .library-card-progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--app-progress-fill);
  }

  .library-card-progress-label {
    color: var(--app-muted-fg);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .library-card-compact-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: var(--app-progress-fill);
  }

  .library-card-check {
    position: absolute;
    top: 0.4rem;
    left: 0.4rem;
    display: inline-flex;
    width: 1.6rem;
    height: 1.6rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--accent-color);
    color: var(--app-accent-fg);
    font-size: 0.8rem;
    pointer-events: none;
  }

  .library-card-remove {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    display: inline-flex;
    width: 1.6rem;
    height: 1.6rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-strong-color) 92%, transparent);
    color: var(--app-danger-color);
    font-size: 0.8rem;
    opacity: 0;
    transition: opacity 0.16s ease;
  }

  .library-card:hover .library-card-remove,
  .library-card-remove:focus-visible {
    opacity: 1;
  }

  @media (hover: none) {
    .library-card-remove {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .library-card-cover {
      transition: none;
    }

    .library-card-main:hover .library-card-cover {
      transform: none;
    }
  }
</style>
