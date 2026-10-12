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
  <section class="shelf" aria-label={heading}>
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
              {#if isReading(book)}
                <span class="shelf-progress"><span style:width="{percent}%" /></span>
              {/if}
            </span>
            <span class="shelf-title" lang="ja">{book.title}</span>
            <span class="shelf-meta">
              {#if isReading(book)}{percent}%{/if}{#if isReading(book) && book.series}&nbsp;·
              {/if}{#if book.series}{formatSeries(book)}{/if}
            </span>
          </button>
          {#if isReading(book)}
            <button
              type="button"
              class="shelf-resume"
              aria-label="Resume {book.title}"
              on:click={() => dispatch('bookClick', { id: book.id })}
            >
              <Fa icon={faBookOpenReader} /> Resume
            </button>
          {/if}
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
    margin-bottom: 2.5rem;
  }

  .shelf-heading {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-bottom: 1rem;
    font-family: var(--app-font-display);
    font-size: 1.15rem;
    font-weight: 400;
  }

  .shelf-heading :global(svg) {
    color: var(--accent-color);
    font-size: 0.85em;
  }

  .shelf-row {
    display: grid;
    grid-auto-columns: 9.5rem;
    grid-auto-flow: column;
    gap: 1.5rem;
    overflow-x: auto;
    padding: 0.25rem 0.25rem 0.5rem;
    scroll-snap-type: x proximity;
  }

  .shelf-count {
    color: var(--app-text-subtle);
    font-family: var(--app-ui-font, 'Noto Sans JP'), sans-serif;
    font-size: 0.8rem;
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
    margin-bottom: 0.35rem;
    border-radius: calc(4px * var(--app-radius-scale));
    box-shadow:
      0 1px 2px var(--app-cover-shadow),
      0 12px 26px -14px var(--app-cover-shadow);
    transition: transform 0.2s var(--app-ease);
  }

  .shelf-book:hover .shelf-cover,
  .shelf-book:focus-visible .shelf-cover {
    transform: translateY(-3px);
  }

  .shelf-book:focus-visible {
    outline: none;
  }

  .shelf-book:focus-visible .shelf-cover {
    outline: 2px solid var(--app-focus-ring);
    outline-offset: 3px;
  }

  .shelf-book-current .shelf-cover {
    outline: 2px solid var(--accent-color);
    outline-offset: 3px;
  }

  .shelf-progress {
    position: absolute;
    inset: auto 0 0;
    height: 3px;
    background: var(--app-progress-track);
  }

  .shelf-progress > span {
    display: block;
    height: 100%;
    background: var(--app-progress-fill);
  }

  .shelf-title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    padding-block: 0.05em;
    font-family: var(--app-font-display);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .shelf-meta {
    overflow: hidden;
    color: var(--app-muted-fg);
    font-size: 0.72rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shelf-resume {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.45rem;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--app-control-border);
    border-radius: calc(0.5rem * var(--app-radius-scale));
    color: var(--accent-strong-color);
    font-size: 0.75rem;
    font-weight: 600;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .shelf-resume:hover {
    border-color: var(--accent-color);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }
</style>
