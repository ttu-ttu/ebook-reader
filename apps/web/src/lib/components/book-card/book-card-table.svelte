<script lang="ts">
  import { faArrowDown, faCheck, faTrash } from '@fortawesome/free-solid-svg-icons';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import DifficultyBadge from '$lib/components/book-card/difficulty-badge.svelte';
  import { formatSeries } from '$lib/components/book-card/library-sort';
  import { SortDirection, type SortOption } from '$lib/data/sort-types';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let bookCards: BookCardProps[] = [];
  export let currentBookId: number | undefined;
  export let selectedBookIds: ReadonlySet<number>;
  export let selectMode = false;
  export let sortOption: SortOption;

  const dispatch = createEventDispatcher<{
    bookClick: { id: number };
    removeBookClick: { id: number };
    sort: SortOption['property'];
  }>();

  const columns: { property: SortOption['property']; label: string }[] = [
    { property: 'title', label: 'Title' },
    { property: 'series', label: 'Series' },
    { property: 'difficulty', label: 'Difficulty' },
    { property: 'progress', label: 'Progress' },
    { property: 'characters', label: 'Characters' },
    { property: 'lastBookOpen', label: 'Last read' },
    { property: 'lastBookmarkModified', label: 'Bookmarked' }
  ];

  const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const relativeTimeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['week', 7 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000]
  ];

  function formatRelative(timestamp: number) {
    if (!timestamp) {
      return '—';
    }

    const diff = timestamp - Date.now();
    const unit = relativeTimeUnits.find(([, ms]) => Math.abs(diff) >= ms);

    return unit
      ? relativeTimeFormat.format(Math.round(diff / unit[1]), unit[0])
      : relativeTimeFormat.format(0, 'minute');
  }

  function formatDate(timestamp: number) {
    return timestamp ? new Date(timestamp).toLocaleString() : 'No data';
  }

  function sortLabel(property: SortOption['property']) {
    if (sortOption.property !== property) {
      return 'not sorted';
    }

    return sortOption.direction === SortDirection.ASC ? 'ascending' : 'descending';
  }
</script>

<div class="library-list">
  <div class="library-list-header" class:library-list-select-mode={selectMode}>
    {#if selectMode}
      <span />
    {/if}
    <div class="library-list-cells">
      {#each columns as column (column.property)}
        <span>
          <button
            type="button"
            class="library-list-header-button"
            aria-label="Sort by {column.label} ({sortLabel(column.property)})"
            on:click={() => dispatch('sort', column.property)}
          >
            {column.label}
            {#if sortOption.property === column.property}
              <span
                class="library-list-sort-icon"
                class:library-list-sort-icon-ascending={sortOption.direction === SortDirection.ASC}
              >
                <Fa icon={faArrowDown} />
              </span>
            {/if}
          </button>
        </span>
      {/each}
    </div>
    <span />
  </div>

  {#each bookCards as bookCard (bookCard.id)}
    {@const selected = selectedBookIds.has(bookCard.id)}
    {@const percent = Math.round((bookCard.progress || 0) * 100)}
    <div
      class="library-list-row"
      class:library-list-select-mode={selectMode}
      class:library-list-row-current={bookCard.id === currentBookId}
      class:library-list-row-selected={selected}
      class:opacity-60={bookCard.isPlaceholder}
    >
      {#if selectMode}
        <span class="flex items-center justify-center">
          <button
            type="button"
            class="library-list-select-button"
            aria-pressed={selected}
            aria-label="Select {bookCard.title}"
            on:click={() => dispatch('bookClick', { id: bookCard.id })}
          >
            {#if selected}<Fa icon={faCheck} />{/if}
          </button>
        </span>
      {/if}
      <button
        type="button"
        class="library-list-cells library-list-row-main"
        on:click={() => dispatch('bookClick', { id: bookCard.id })}
      >
        <span class="library-list-title" title={bookCard.title}>{bookCard.title}</span>
        <span class="library-list-secondary truncate" title={formatSeries(bookCard)}>
          {formatSeries(bookCard) || '—'}
        </span>
        <span class="library-list-secondary">
          {#if bookCard.difficulty !== undefined}
            <DifficultyBadge difficulty={bookCard.difficulty} />
          {:else}
            —
          {/if}
        </span>
        <span class="library-list-progress-cell">
          <span class="library-list-progress">
            <span class="library-list-progress-value" style:width="{percent}%" />
          </span>
          <span class="library-list-secondary font-extrabold">{percent}%</span>
        </span>
        <span class="library-list-secondary">
          {bookCard.characters ? bookCard.characters.toLocaleString() : '—'}
        </span>
        <span class="library-list-secondary" title={formatDate(bookCard.lastBookOpen)}>
          {formatRelative(bookCard.lastBookOpen)}
        </span>
        <span class="library-list-secondary" title={formatDate(bookCard.lastBookmarkModified)}>
          {formatRelative(bookCard.lastBookmarkModified)}
        </span>
      </button>
      <span class="library-list-action-cell">
        {#if !selectMode}
          <button
            type="button"
            class="library-list-action-button"
            title="Delete book"
            aria-label="Delete {bookCard.title}"
            on:click={() => dispatch('removeBookClick', { id: bookCard.id })}
          >
            <Fa icon={faTrash} />
          </button>
        {/if}
      </span>
    </div>
  {/each}
</div>

<style>
  .library-list {
    --library-list-columns: minmax(16rem, 3.6fr) minmax(8rem, 1.2fr) minmax(7rem, 0.6fr)
      minmax(8.5rem, 0.82fr) minmax(6.5rem, 0.55fr)
      minmax(7rem, 0.62fr) minmax(7rem, 0.62fr);

    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    max-width: 100%;
    padding-bottom: 1rem;
    overflow-x: auto;
  }

  .library-list-header,
  .library-list-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 2.75rem;
    gap: 0.5rem;
    min-width: 68rem;
  }

  .library-list-select-mode {
    grid-template-columns: 2.65rem minmax(0, 1fr) 2.75rem;
  }

  .library-list-header {
    align-items: center;
    padding: 0 0.35rem 0.25rem;
    color: color-mix(in srgb, var(--font-color) 58%, var(--surface-color));
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .library-list-cells {
    display: grid;
    grid-template-columns: var(--library-list-columns);
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .library-list-header .library-list-cells {
    padding-left: 0.75rem;
  }

  .library-list-header-button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0;
    letter-spacing: inherit;
    text-transform: inherit;
    transition: color 0.16s ease;
  }

  .library-list-header-button:hover,
  .library-list-header-button:focus-visible {
    color: var(--font-color);
    outline: none;
  }

  .library-list-sort-icon {
    display: inline-flex;
    color: var(--accent-strong-color);
    font-size: 0.66rem;
    transition: transform 0.16s ease;
  }

  .library-list-sort-icon-ascending {
    transform: rotate(180deg);
  }

  .library-list-row {
    position: relative;
    align-items: stretch;
    box-sizing: border-box;
    min-height: 3.35rem;
    padding: 0.35rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
    border-radius: 0.95rem;
    background: color-mix(in srgb, var(--surface-strong-color) 92%, var(--background-color));
    box-shadow:
      0 14px 34px -34px var(--shadow-color),
      inset 0 1px var(--app-inset-highlight);
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }

  .library-list-row:hover,
  .library-list-row:focus-within {
    border-color: color-mix(in srgb, var(--accent-color) 38%, var(--border-color));
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent-color) 18%, transparent),
      0 18px 38px -34px var(--shadow-color);
  }

  .library-list-row-current,
  .library-list-row-selected {
    border-color: color-mix(in srgb, var(--accent-color) 62%, var(--border-color));
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent-color) 30%, transparent),
      0 18px 38px -34px var(--shadow-color);
  }

  .library-list-row-selected {
    background: color-mix(in srgb, var(--accent-color) 6%, var(--surface-strong-color));
  }

  .library-list-row-main {
    padding: 0 0 0 0.4rem;
    color: var(--font-color);
    text-align: left;
  }

  .library-list-row-main:focus-visible {
    outline: none;
  }

  .library-list-title {
    overflow: hidden;
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-list-secondary {
    overflow: hidden;
    color: color-mix(in srgb, var(--font-color) 66%, var(--surface-color));
    font-size: 0.8rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-list-progress-cell {
    display: grid;
    grid-template-columns: minmax(2.8rem, 1fr) auto;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .library-list-progress {
    position: relative;
    height: 0.55rem;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--font-color) 12%, var(--surface-color));
  }

  .library-list-progress-value {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent-color), var(--accent-strong-color));
  }

  .library-list-select-button,
  .library-list-action-button {
    display: inline-flex;
    width: 2.2rem;
    height: 2.2rem;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--font-color) 9%, var(--border-color));
    border-radius: 0.78rem;
    background: color-mix(in srgb, var(--surface-color) 94%, var(--background-color));
    color: color-mix(in srgb, var(--font-color) 72%, var(--surface-color));
    font-size: 0.85rem;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;
  }

  .library-list-select-button[aria-pressed='true'] {
    border-color: color-mix(in srgb, var(--accent-color) 72%, var(--border-color));
    background: var(--accent-color);
    color: var(--app-accent-fg);
  }

  .library-list-action-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 0.35rem;
    border-left: 1px solid color-mix(in srgb, var(--font-color) 7%, transparent);
  }

  .library-list-action-button {
    border-color: transparent;
    background: transparent;
  }

  .library-list-row:hover .library-list-action-button,
  .library-list-action-button:focus-visible {
    border-color: color-mix(in srgb, var(--app-danger-color) 34%, var(--border-color));
    background: color-mix(in srgb, var(--app-danger-color) 10%, var(--surface-strong-color));
    color: var(--app-danger-color);
    outline: none;
  }
</style>
