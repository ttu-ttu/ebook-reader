<script lang="ts">
  import {
    faBookOpenReader,
    faXmark,
    type IconDefinition
  } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import { isReading } from '$lib/components/book-card/library-filters';
  import { formatSeries } from '$lib/components/book-card/library-sort';
  import { longPress } from '$lib/functions/use-long-press';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let bookCards: BookCardProps[];
  export let currentBookId: number | undefined;
  /** Other shelves (Home → My books) pass their books and heading */
  export let shelfBooks: BookCardProps[] | undefined = undefined;
  export let heading = 'Continue reading';
  export let icon: IconDefinition = faBookOpenReader;
  export let removeTitle = '';

  const dispatch = createEventDispatcher<{
    bookClick: { id: number };
    /** Long press: select the book */
    bookSelect: { id: number };
    remove: BookCardProps;
  }>();
  const maxBooks = 12;

  // lastBookOpen is stored with the shared book file; the bookmark time is per account.
  const lastRead = (card: BookCardProps) =>
    Math.max(card.lastBookOpen || 0, card.lastBookmarkModified || 0);

  $: books =
    shelfBooks ??
    bookCards
      .filter((card) => isReading(card) && lastRead(card))
      .sort((a, b) => lastRead(b) - lastRead(a))
      .slice(0, maxBooks);
</script>

{#if books.length}
  <section class="shelf app-surface-card" aria-label={heading}>
    <h2 class="shelf-heading">
      <Fa {icon} />
      {heading}
      <span class="shelf-count">{books.length}</span>
    </h2>
    <div class="shelf-row">
      {#each books as book (book.id)}
        {@const percent = Math.round(book.progress * 100)}
        <div class="shelf-item">
          <button
            type="button"
            class="shelf-book"
            class:shelf-book-current={book.id === currentBookId}
            title={book.title}
            on:click={() => dispatch('bookClick', { id: book.id })}
            use:longPress={() => dispatch('bookSelect', { id: book.id })}
          >
            <span class="shelf-cover">
              <BookCard imagePath={book.imagePath} title={book.title} />
              <span class="shelf-progress"><span style:width="{percent}%" /></span>
            </span>
            <span class="shelf-title">{book.title}</span>
            <span class="shelf-meta">
              {percent}%{#if book.series}&nbsp;· {formatSeries(book)}{/if}
            </span>
          </button>
          {#if removeTitle}
            <button
              type="button"
              class="shelf-remove"
              title={removeTitle}
              aria-label="{removeTitle}: {book.title}"
              on:click={() => dispatch('remove', book)}
            >
              <Fa icon={faXmark} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .shelf {
    margin-bottom: 1.25rem;
    padding: 0.9rem 0.9rem 0.75rem;
    border-radius: calc(1.15rem * var(--app-radius-scale));
  }

  .shelf-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.7rem;
    color: var(--app-muted-fg);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .shelf-row {
    display: grid;
    grid-auto-columns: 7.25rem;
    grid-auto-flow: column;
    gap: 0.85rem;
    overflow-x: auto;
    padding-bottom: 0.35rem;
    scroll-snap-type: x proximity;
  }

  .shelf-count {
    margin-left: auto;
    font-weight: 700;
    letter-spacing: 0;
  }

  .shelf-item {
    position: relative;
    min-width: 0;
    scroll-snap-align: start;
  }

  .shelf-remove {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    display: inline-flex;
    width: 1.6rem;
    height: 1.6rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--reader-panel-bg);
    color: var(--reader-panel-fg);
    font-size: 0.75rem;
    opacity: 0;
    transition: opacity 0.16s ease;
  }

  .shelf-item:hover .shelf-remove,
  .shelf-remove:focus-visible {
    opacity: 1;
  }

  @media (hover: none) {
    .shelf-remove {
      opacity: 0.85;
    }
  }

  .shelf-book {
    /* No iOS image callout or text selection on a long press (it selects the book). */
    -webkit-touch-callout: none;
    user-select: none;
    display: flex;
    width: 100%;
    min-width: 0;
    flex-direction: column;
    gap: 0.3rem;
    text-align: left;
  }

  .shelf-cover {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: calc(0.7rem * var(--app-radius-scale));
    transition: transform 0.16s ease;
  }

  .shelf-book:hover .shelf-cover,
  .shelf-book:focus-visible .shelf-cover {
    transform: translateY(-2px);
  }

  .shelf-book-current .shelf-cover {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 35%, transparent);
  }

  .shelf-progress {
    position: absolute;
    inset: auto 0 0;
    height: 0.3rem;
    background: color-mix(in srgb, var(--font-color) 18%, transparent);
  }

  .shelf-progress > span {
    display: block;
    height: 100%;
    background: var(--accent-color);
  }

  .shelf-title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .shelf-meta {
    overflow: hidden;
    color: var(--app-muted-fg);
    font-size: 0.7rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
