<script lang="ts">
  import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import DifficultyBadge from '$lib/components/book-card/difficulty-badge.svelte';
  import { formatSeries } from '$lib/components/book-card/library-sort';
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
      >
        <BookCard imagePath={bookCard.imagePath} title={bookCard.title} />
        {#if compact}
          <span class="library-card-compact-progress" style:width="{percent}%" />
        {:else}
          <span class="library-card-body">
            <span class="library-card-title">{bookCard.title}</span>
            {#if bookCard.series || bookCard.difficulty !== undefined}
              <span class="library-card-meta">
                {#if bookCard.series}
                  <span class="library-card-series" title="Series: {formatSeries(bookCard)}"
                    >{formatSeries(bookCard)}</span
                  >
                {/if}
                {#if bookCard.difficulty !== undefined}
                  <DifficultyBadge difficulty={bookCard.difficulty} compact />
                {/if}
              </span>
            {/if}
            <span class="library-card-progress">
              <span class="library-card-progress-fill" style:width="{percent}%" />
              <span class="library-card-progress-label">{percent}%</span>
            </span>
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
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 11.5rem), 1fr));
    gap: 1.25rem;
    padding-bottom: 1rem;
  }

  .library-grid-compact {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr));
    gap: 0.9rem;
  }

  @media (max-width: 639px) {
    .library-grid {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr));
      gap: 0.85rem;
    }

    .library-grid-compact {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr));
    }
  }

  .library-card {
    position: relative;
    display: flex;
    flex-direction: column;
    border: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
    border-radius: 0 0 0.95rem 0.95rem;
    background: color-mix(in srgb, var(--surface-strong-color) 92%, var(--background-color));
    box-shadow:
      0 18px 42px -34px var(--shadow-color),
      inset 0 1px var(--app-inset-highlight);
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }

  .library-card:hover,
  .library-card:focus-within {
    border-color: color-mix(in srgb, var(--accent-color) 38%, var(--border-color));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent-color) 18%, transparent),
      0 18px 38px -30px var(--shadow-color);
    transform: translateY(-1px);
  }

  .library-card-current,
  .library-card-selected {
    border-color: color-mix(in srgb, var(--accent-color) 62%, var(--border-color));
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent-color) 30%, transparent),
      0 18px 38px -34px var(--shadow-color);
  }

  .library-card-selected {
    background: color-mix(in srgb, var(--accent-color) 6%, var(--surface-strong-color));
  }

  .library-card-main {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    border-radius: inherit;
    text-align: left;
  }

  .library-card-main:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent-color) 64%, transparent);
    outline-offset: 2px;
  }

  .library-card-body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem 0.875rem;
    border-top: 1px solid color-mix(in srgb, var(--font-color) 9%, transparent);
  }

  .library-card-meta {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    margin-top: -0.3rem;
  }

  .library-card-series {
    overflow: hidden;
    color: var(--app-muted-fg);
    font-size: 0.72rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-card-title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .library-card-progress {
    position: relative;
    display: block;
    height: 1.25rem;
    margin-top: auto;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--font-color) 8%, var(--surface-color));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--font-color) 5%, transparent);
  }

  .library-card-progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--accent-color) 55%, transparent),
      color-mix(in srgb, var(--accent-strong-color) 70%, transparent)
    );
  }

  .library-card-progress-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 800;
  }

  .library-card-compact-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 0.3rem;
    background: linear-gradient(90deg, var(--accent-color), var(--accent-strong-color));
  }

  .library-card-check {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    display: inline-flex;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--accent-color);
    color: var(--app-accent-fg);
    font-size: 0.85rem;
    pointer-events: none;
    box-shadow: 0 6px 16px -8px var(--shadow-color);
  }

  .library-card-remove {
    position: absolute;
    top: -0.5rem;
    right: -0.5rem;
    display: inline-flex;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--app-danger-color) 40%, var(--border-color));
    border-radius: 999px;
    background: color-mix(in srgb, var(--app-danger-color) 14%, var(--surface-strong-color));
    color: var(--app-danger-color);
    font-size: 0.85rem;
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
    .library-card:hover,
    .library-card:focus-within {
      transform: none;
    }
  }
</style>
