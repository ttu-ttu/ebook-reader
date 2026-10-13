<script lang="ts">
  import {
    faChevronDown,
    faMagnifyingGlass,
    faSliders,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import {
    allBooksFilter,
    countBookCards,
    getLibraryFilter,
    libraryFilterSections
  } from '$lib/components/book-card/library-filters';
  import { libraryCollapsedFilterSections$ } from '$lib/data/store';
  import Fa from 'svelte-fa';

  export let bookCards: BookCardProps[] = [];
  export let loading = false;
  export let activeFilter = allBooksFilter.key;
  export let searchTerm = '';

  let mobileOpen = false;

  $: counts = countBookCards(bookCards);
  $: activeFilterLabel = getLibraryFilter(activeFilter).label;

  function toggleSection(sectionKey: string) {
    const collapsed = new Set($libraryCollapsedFilterSections$);

    if (collapsed.has(sectionKey)) {
      collapsed.delete(sectionKey);
    } else {
      collapsed.add(sectionKey);
    }

    $libraryCollapsedFilterSections$ = [...collapsed];
  }

  function selectFilter(filterKey: string) {
    activeFilter = filterKey;
    mobileOpen = false;
  }
</script>

<aside class="library-sidebar" aria-label="Library filters">
  <button
    type="button"
    class="library-sidebar-toggle"
    aria-expanded={mobileOpen}
    on:click={() => (mobileOpen = !mobileOpen)}
  >
    <span class="flex min-w-0 items-center gap-3">
      <Fa icon={faSliders} />
      <span class="truncate">{activeFilterLabel}</span>
      {#if !loading}
        <span class="library-filter-count">{counts.get(activeFilter) ?? 0}</span>
      {/if}
    </span>
    <span class="library-filter-chevron" class:library-filter-chevron-expanded={mobileOpen}>
      <Fa icon={faChevronDown} />
    </span>
  </button>

  <div class="library-sidebar-content" class:library-sidebar-content-open={mobileOpen}>
    {#if loading}
      <div class="library-filter-search">
        <span class="app-skeleton h-[1.1rem] w-[1.1rem] rounded-full" />
        <span class="app-skeleton h-3 w-2/3 rounded-full" />
      </div>
      {#each [3, 4, 3] as rows}
        <div class="mt-4 flex flex-col gap-3 px-3">
          <div class="flex items-center justify-between">
            <span class="app-skeleton h-3 w-1/3 rounded-full" />
            <span class="app-skeleton h-5 w-5 rounded-full" />
          </div>
          {#each { length: rows } as _}
            <span class="app-skeleton ml-5 h-3 w-1/2 rounded-full" />
          {/each}
        </div>
      {/each}
    {:else}
      <label class="library-filter-search">
        <Fa icon={faMagnifyingGlass} />
        <input
          type="search"
          class="library-filter-search-input"
          placeholder="Search titles, series, tags"
          autocomplete="off"
          bind:value={searchTerm}
        />
        {#if searchTerm}
          <button
            type="button"
            class="library-filter-search-clear"
            title="Clear search"
            on:click={() => (searchTerm = '')}
          >
            <Fa icon={faXmark} />
          </button>
        {/if}
      </label>

      <button
        type="button"
        class="library-filter-row mt-2"
        class:library-filter-row-active={activeFilter === allBooksFilter.key}
        on:click={() => selectFilter(allBooksFilter.key)}
      >
        <span>{allBooksFilter.label}</span>
        <span class="library-filter-count">{counts.get(allBooksFilter.key) ?? 0}</span>
      </button>

      {#each libraryFilterSections as section (section.key)}
        {@const expanded = !$libraryCollapsedFilterSections$.includes(section.key)}
        <section
          class="library-filter-section"
          class:library-filter-section-active={section.filters.some(
            (filter) => filter.key === activeFilter
          )}
        >
          <button
            type="button"
            class="library-filter-section-toggle"
            aria-expanded={expanded}
            on:click={() => toggleSection(section.key)}
          >
            <span>{section.label}</span>
            <span class="flex items-center gap-1.5">
              <span class="library-filter-count">
                {section.filters.reduce((sum, filter) => sum + (counts.get(filter.key) ?? 0), 0)}
              </span>
              <span class="library-filter-chevron" class:library-filter-chevron-expanded={expanded}>
                <Fa icon={faChevronDown} />
              </span>
            </span>
          </button>
          {#if expanded}
            <div class="library-filter-list">
              {#each section.filters as filter (filter.key)}
                <button
                  type="button"
                  class="library-filter-row"
                  class:library-filter-row-active={activeFilter === filter.key}
                  on:click={() => selectFilter(filter.key)}
                >
                  <span>{filter.label}</span>
                  <span class="library-filter-count">{counts.get(filter.key) ?? 0}</span>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .library-sidebar {
    --library-sidebar-fg: var(--font-color);
    --library-sidebar-muted: var(--app-muted-fg);
    --library-sidebar-hover-bg: color-mix(in srgb, var(--font-color) 5%, transparent);
    --library-sidebar-control-bg: var(--app-control-bg);
    --library-sidebar-control-border: var(--app-control-border);

    position: fixed;
    top: calc(var(--library-header-height) - 1px);
    left: 0;
    z-index: 11;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: var(--library-sidebar-width);
    height: calc(100dvh - var(--library-header-height) + 1px);
    border-right: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--library-sidebar-fg);
  }

  .library-sidebar-toggle {
    display: none;
  }

  .library-sidebar-content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    padding: 1rem 0.9rem 2rem;
    overflow-y: auto;
  }

  .library-filter-search {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    min-height: 2.5rem;
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--library-sidebar-control-border);
    border-radius: calc(0.6rem * var(--app-radius-scale));
    background: var(--library-sidebar-control-bg);
    color: var(--library-sidebar-muted);
    transition:
      background-color 0.16s ease,
      color 0.16s ease;
  }

  .library-filter-search:focus-within {
    border-color: var(--app-focus-ring);
    box-shadow: 0 0 0 1px var(--app-focus-ring);
    color: var(--library-sidebar-fg);
  }

  .library-filter-search-input {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--library-sidebar-fg);
    font-size: 0.9rem;
    outline: none;
    appearance: none;
  }

  .library-filter-search-input:focus {
    box-shadow: none;
  }

  .library-filter-search-input::placeholder {
    color: var(--library-sidebar-muted);
    opacity: 1;
  }

  .library-filter-search-input::-webkit-search-cancel-button {
    appearance: none;
  }

  .library-filter-search-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--library-sidebar-fg) 8%, transparent);
  }

  .library-filter-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 1.1rem;
  }

  .library-filter-section-toggle,
  .library-filter-row {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.55rem;
    border-radius: calc(0.4rem * var(--app-radius-scale));
    color: var(--library-sidebar-muted);
    text-align: left;
    transition:
      background-color 0.16s ease,
      color 0.16s ease;
  }

  .library-filter-section-toggle > span:first-child,
  .library-filter-row > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-filter-section-toggle {
    min-height: 1.9rem;
    padding: 0.3rem 0.55rem;
    color: var(--app-text-subtle);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .library-filter-row {
    min-height: 2.1rem;
    padding: 0.35rem 0.65rem;
    font-size: 0.88rem;
  }

  .library-filter-section-toggle:hover,
  .library-filter-row:hover {
    background: var(--library-sidebar-hover-bg);
    color: var(--library-sidebar-fg);
  }

  .library-filter-row-active,
  .library-filter-row-active:hover {
    background: transparent;
    box-shadow: inset 2px 0 var(--accent-color);
    color: var(--library-sidebar-fg);
    font-weight: 650;
  }

  .library-filter-section-toggle:focus-visible,
  .library-filter-row:focus-visible {
    outline: 2px solid var(--app-focus-ring);
    outline-offset: -2px;
  }

  .library-filter-list {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    margin-left: 0.62rem;
    padding-left: 0.45rem;
    border-left: 1px solid var(--border-color);
  }

  .library-filter-count {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--app-text-subtle);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  /* Counts only where they help: the active filter's group, and under the pointer */
  .library-filter-row:hover .library-filter-count,
  .library-filter-row-active .library-filter-count,
  .library-filter-section-active .library-filter-count,
  .library-sidebar-toggle .library-filter-count {
    opacity: 1;
  }

  .library-filter-chevron {
    display: inline-flex;
    font-size: 0.7rem;
    transition: transform 0.18s ease;
  }

  .library-filter-chevron-expanded {
    transform: rotate(180deg);
  }

  @media (max-width: 900px) {
    .library-sidebar {
      position: relative;
      top: auto;
      z-index: 20;
      width: auto;
      height: auto;
      border-right: 0;
      background: transparent;
    }

    .library-sidebar::before {
      content: none;
    }

    .library-sidebar-toggle {
      display: flex;
      width: 100%;
      min-height: 2.75rem;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.6rem 0.9rem;
      border: 1px solid var(--library-sidebar-control-border);
      border-radius: calc(0.6rem * var(--app-radius-scale));
      background: var(--app-control-bg);
      font-weight: 600;
    }

    .library-sidebar-content {
      display: none;
    }

    .library-sidebar-content-open {
      display: flex;
      margin-top: 0.55rem;
      padding: 0.85rem;
      border: 1px solid var(--border-color);
      border-radius: calc(0.6rem * var(--app-radius-scale));
      background: var(--surface-strong-color);
      box-shadow: 0 18px 40px -28px var(--shadow-color);
    }
  }
</style>
