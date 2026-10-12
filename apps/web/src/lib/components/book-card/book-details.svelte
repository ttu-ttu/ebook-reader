<script lang="ts">
  import {
    faArrowLeft,
    faBookOpen,
    faBookOpenReader,
    faHouse,
    faMagnifyingGlass,
    faSpinner,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import ContinueReadingShelf from '$lib/components/book-card/continue-reading-shelf.svelte';
  import DifficultyBadge from '$lib/components/book-card/difficulty-badge.svelte';
  import DifficultyDialog from '$lib/components/book-card/difficulty-dialog.svelte';
  import { isFinished, isReading } from '$lib/components/book-card/library-filters';
  import { formatSeries, orderSeries } from '$lib/components/book-card/library-sort';
  import { account$, hasPermission } from '$lib/data/account';
  import {
    loadBookMetadata,
    metadataSourceName,
    saveBookMetadata,
    searchMetadata,
    type BookMetadata,
    type MetadataCandidate,
    type MetadataKind
  } from '$lib/data/book-metadata';
  import {
    loadBookKanji,
    loadCalibreCatalog,
    loadCalibreDifficulty,
    type CalibreBook,
    type CalibreDifficulty
  } from '$lib/data/calibre';
  import { difficultyName } from '$lib/data/difficulty';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { getKanjiSeen, kanjiCoverage, type KanjiCoverage } from '$lib/data/kanji-seen';
  import { learnerStats } from '$lib/data/learner-stats';
  import { addToHome, homeBookTitles$, removeFromHome } from '$lib/data/library-home';
  import { guessSeriesName } from '$lib/data/series-overrides';
  import { database, startDayHoursForTracker$ } from '$lib/data/store';
  import { getDateKey } from '$lib/functions/statistic-util';
  import { createEventDispatcher, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  /**
   * A book's page in the library (Store clicks, Home covers): length,
   * difficulty, Calibre metadata and details fetched from AniList or VNDB.
   * Not part of upstream.
   */

  export let book: BookCardProps;
  export let bookCards: BookCardProps[];
  /** Calibre source: catalog metadata, difficulty and shared details exist */
  export let isCalibre: boolean;

  const dispatch = createEventDispatcher<{
    close: void;
    read: { id: number };
    showBook: { id: number };
    showSeries: string;
    /** Saved details changed the library (a cover) */
    changed: void;
  }>();

  let backButton: HTMLButtonElement;
  let calibreBook: CalibreBook | undefined;
  let estimate: CalibreDifficulty | undefined;
  let kanji: KanjiCoverage | undefined;
  let speed = 0;
  let metadata: BookMetadata | undefined;
  let searching = false;
  let searchOpen = false;
  let searchTerm = '';
  let searchRequest = 0;
  let searchError = '';
  let saving = false;
  let candidates: MetadataCandidate[] | undefined;

  const number = (value: number) => value.toLocaleString('en-US');

  $: kind = (book.vn ? 'vn' : book.manga ? 'manga' : 'book') as MetadataKind;
  $: kindLabel = { book: '小説', manga: '漫画', vn: 'ノベルゲーム' }[kind];
  $: characters = book.characters || estimate?.characters || 0;
  $: obiLength =
    kind === 'manga' ? (characters ? `${characters}頁` : '') : japaneseLength(characters);
  $: remaining = isReading(book) ? characters * (1 - book.progress) : characters;
  $: canEdit = isCalibre && hasPermission($account$, 'series');
  $: onHome = $homeBookTitles$.includes(book.title);
  $: seriesBooks = book.series
    ? orderSeries(bookCards.filter((card) => card.series === book.series))
    : [];
  $: genres = [...new Set([...(book.tags ?? []), ...(metadata?.genres ?? [])])];
  $: published = calibreBook?.published
    ? new Date(calibreBook.published).getFullYear().toString()
    : metadata?.released.slice(0, 4);
  $: (book.title, load());

  onMount(() => {
    backButton.focus();
    loadSpeed();
  });

  function japaneseLength(count: number) {
    if (!count) {
      return '';
    }

    return count >= 10000
      ? `${(count / 10000).toFixed(count >= 1e6 ? 0 : 1).replace(/\.0$/, '')}万字`
      : `${number(count)}字`;
  }

  function hours(count: number) {
    const value = count / speed;

    return value < 1 ? `${Math.max(1, Math.round(value * 60))} min` : `${value.toFixed(1)} h`;
  }

  async function loadSpeed() {
    const statistics = await database
      .getStatisticsForTimeWindow('0000-00-00', '9999-99-99')
      .catch(() => []);

    speed = learnerStats(statistics, getDateKey($startDayHoursForTracker$)).speed;
  }

  async function load() {
    const title = book.title;

    calibreBook = undefined;
    estimate = undefined;
    kanji = undefined;
    metadata = undefined;
    candidates = undefined;
    searchOpen = false;
    searchError = '';

    if (!isCalibre) {
      return;
    }

    const [catalog, difficulty, details] = await Promise.all([
      loadCalibreCatalog().catch(() => []),
      book.calibreId === undefined ? undefined : loadCalibreDifficulty().catch(() => undefined),
      loadBookMetadata().catch(() => ({}) as Record<string, BookMetadata>)
    ]);

    if (title !== book.title) {
      return;
    }

    calibreBook = catalog.find((entry) => entry.title === title);
    estimate = book.calibreId === undefined ? undefined : difficulty?.[book.calibreId];
    metadata = details[title];

    if (estimate && book.calibreId !== undefined) {
      const [counts, seen] = await Promise.all([
        loadBookKanji(book.calibreId).catch(() => undefined),
        getKanjiSeen().catch(() => [])
      ]);

      if (title === book.title && counts && seen.length) {
        kanji = kanjiCoverage(counts, seen);
      }
    }
  }

  function openSearch() {
    searchOpen = true;
    searchTerm ||= guessSeriesName(book.title);
    search();
  }

  async function search() {
    if (!searchTerm.trim()) {
      return;
    }

    const request = (searchRequest += 1);

    searching = true;
    searchError = '';
    try {
      const results = await searchMetadata(kind, searchTerm.trim());

      // An older search answering late must not replace a newer one's results.
      if (request === searchRequest) {
        candidates = results;
      }
    } catch (error: any) {
      if (request === searchRequest) {
        searchError = `${metadataSourceName(kind)} search failed: ${error.message}`;
      }
    } finally {
      if (request === searchRequest) {
        searching = false;
      }
    }
  }

  async function save(entry: MetadataCandidate | undefined) {
    saving = true;
    searchError = '';
    try {
      metadata = (await saveBookMetadata(book.title, entry))[book.title];
      searchOpen = false;
      dispatch('changed');
    } catch (error: any) {
      searchError = error.message;
    } finally {
      saving = false;
    }
  }

  function showDifficulty() {
    dialogManager.dialogs$.next([{ component: DifficultyDialog, props: { books: [book] } }]);
  }

  function toggleHome() {
    if (onHome) {
      removeFromHome(book.title);
    } else {
      addToHome([book.title]);
    }
  }
</script>

<svelte:window on:keydown={(ev) => ev.key === 'Escape' && !searchOpen && dispatch('close')} />

<div class="details" role="dialog" aria-modal="true" aria-labelledby="book-details-title">
  <div class="details-bar">
    <button
      type="button"
      class="app-button app-button-quiet"
      bind:this={backButton}
      on:click={() => dispatch('close')}
    >
      <Fa icon={faArrowLeft} /> Library
    </button>
  </div>

  <div class="details-body">
    <div class="details-aside">
      <div class="details-cover">
        <BookCard imagePath={book.imagePath} title={book.title} />
        <!-- The obi (帯): the band publishers wrap around Japanese books -->
        <span class="details-obi" aria-hidden="true">
          <span class="details-obi-main">{obiLength || kindLabel}</span>
          <span class="details-obi-sub">
            {obiLength ? kindLabel : ''}{#if book.difficulty !== undefined}{obiLength
                ? '・'
                : ''}{difficultyName(book.difficulty)}{/if}
          </span>
        </span>
      </div>

      <div class="details-actions">
        <button
          type="button"
          class="app-button app-button-primary"
          on:click={() => dispatch('read', { id: book.id })}
        >
          <Fa icon={isReading(book) ? faBookOpenReader : faBookOpen} />
          {#if isReading(book)}Resume at {Math.round(
              book.progress * 100
            )}%{:else if isFinished(book)}Read again{:else}Read{/if}
        </button>
        <button type="button" class="app-button" aria-pressed={onHome} on:click={toggleHome}>
          <Fa icon={onHome ? faXmark : faHouse} />
          {onHome ? 'Remove from Home' : 'Add to Home'}
        </button>
      </div>
    </div>

    <div class="details-main">
      <h1 id="book-details-title" class="details-title" lang="ja">{book.title}</h1>
      {#if book.authors && book.authors !== 'Unknown'}
        <p class="details-author" lang="ja">{book.authors}</p>
      {/if}
      {#if book.series}
        <button
          type="button"
          class="details-series"
          lang="ja"
          on:click={() => dispatch('showSeries', book.series ?? '')}
        >
          {formatSeries(book)}
        </button>
      {/if}

      {#if metadata?.description}
        <div class="details-description">
          <p lang="ja">{metadata.description}</p>
          <a href={metadata.url} target="_blank" rel="noreferrer">
            From {metadata.source === 'vndb' ? 'VNDB' : 'AniList'}
          </a>
        </div>
      {/if}

      <dl class="details-facts">
        <div>
          <dt>Length</dt>
          <dd>
            {#if !characters}
              Unknown until opened or estimated
            {:else if kind === 'manga'}
              {number(characters)} pages
            {:else}
              {number(characters)} characters
              {#if speed}
                <span class="details-note">
                  About {hours(remaining)}{isReading(book) ? ' left' : ''} at your speed ({number(
                    speed
                  )}/h)
                </span>
              {/if}
            {/if}
          </dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>
            {#if isFinished(book)}Finished{:else if isReading(book)}{Math.round(
                book.progress * 100
              )}%{:else}Not started{/if}
          </dd>
        </div>
        {#if isCalibre && kind !== 'manga' && book.calibreId !== undefined}
          <div>
            <dt>Difficulty</dt>
            <dd>
              {#if book.difficulty !== undefined}
                <DifficultyBadge
                  difficulty={book.difficulty}
                  low={book.difficultyLow}
                  high={book.difficultyHigh}
                  words95={book.words95}
                />
                <span class="details-note">
                  {book.difficulty.toFixed(1)} of 5{#if book.difficultyLow !== undefined && book.difficultyHigh !== undefined},
                    likely {book.difficultyLow.toFixed(1)}–{book.difficultyHigh.toFixed(
                      1
                    )}{/if}{#if book.words95}. The {number(book.words95)} most common words cover 95%
                    of it{/if}{#if estimate?.uniqueKanji}. {number(estimate.uniqueKanji)} different kanji{/if}{#if kanji},
                    {(kanji.coverage * 100).toFixed(1)}% already met{#if kanji.newKanji}
                      ({number(kanji.newKanji)} new){/if}{/if}.
                </span>
              {:else}
                No estimate yet
              {/if}
              <button type="button" class="details-link" on:click={showDifficulty}>
                Difficulty details
              </button>
            </dd>
          </div>
        {/if}
        {#if calibreBook?.publisher}
          <div>
            <dt>Publisher</dt>
            <dd lang="ja">{calibreBook.publisher}</dd>
          </div>
        {/if}
        {#if published}
          <div>
            <dt>Published</dt>
            <dd>{published}</dd>
          </div>
        {/if}
        {#if book.rating}
          <div>
            <dt>Rating</dt>
            <dd aria-label="{book.rating} of 5 stars">
              {'★'.repeat(Math.round(book.rating))}{'☆'.repeat(5 - Math.round(book.rating))}
            </dd>
          </div>
        {/if}
        {#if metadata?.score}
          <div>
            <dt>{metadata.source === 'vndb' ? 'VNDB' : 'AniList'} score</dt>
            <dd>{metadata.score} / 100</dd>
          </div>
        {/if}
        {#if calibreBook}
          <div>
            <dt>File</dt>
            <dd>
              {calibreBook.format === 'VN'
                ? 'Game folder'
                : calibreBook.format}{#if calibreBook.size},
                {(calibreBook.size / 1e6).toFixed(1)} MB{/if}, added {new Date(
                calibreBook.added
              ).toLocaleDateString()}
            </dd>
          </div>
        {/if}
      </dl>

      {#if genres.length}
        <ul class="details-tags" aria-label="Tags">
          {#each genres as genre (genre)}
            <li lang="ja">{genre}</li>
          {/each}
        </ul>
      {/if}

      {#if canEdit}
        <section class="details-fetch" aria-labelledby="book-details-fetch">
          {#if !searchOpen}
            <button type="button" class="app-button" on:click={openSearch}>
              <Fa icon={faMagnifyingGlass} />
              {metadata ? 'Change details' : `Find details on ${metadataSourceName(kind)}`}
            </button>
            {#if metadata}
              <button
                type="button"
                class="app-button app-button-quiet"
                disabled={saving}
                on:click={() => save(undefined)}
              >
                Remove details{metadata.cover ? ' and cover' : ''}
              </button>
            {/if}
          {:else}
            <h2 id="book-details-fetch" class="details-fetch-heading">
              Find details on {metadataSourceName(kind)}
            </h2>
            <form class="details-search" on:submit|preventDefault={search}>
              <input
                class="app-input"
                type="search"
                lang="ja"
                aria-label="Search {metadataSourceName(kind)}"
                bind:value={searchTerm}
                on:keydown={(ev) => ev.key === 'Escape' && (searchOpen = false)}
              />
              <button type="submit" class="app-button">
                <Fa icon={searching ? faSpinner : faMagnifyingGlass} spin={searching} /> Search
              </button>
              <button
                type="button"
                class="app-button app-button-quiet"
                on:click={() => (searchOpen = false)}
              >
                Cancel
              </button>
            </form>
            {#if candidates && !candidates.length && !searching}
              <p class="details-note">Nothing found. Try the series name without volume numbers.</p>
            {/if}
            {#if candidates?.length}
              <ul class="details-candidates">
                {#each candidates as candidate (candidate.url)}
                  <li>
                    {#if candidate.cover}
                      <img
                        src={candidate.cover}
                        alt=""
                        loading="lazy"
                        referrerpolicy="no-referrer"
                      />
                    {:else}
                      <span class="details-candidate-blank" />
                    {/if}
                    <span class="details-candidate-text">
                      <a href={candidate.url} target="_blank" rel="noreferrer" lang="ja">
                        {candidate.title}
                      </a>
                      <span class="details-note">
                        {candidate.released.slice(0, 4) || 'Undated'}{#if candidate.genres.length},
                          {candidate.genres.slice(0, 3).join(', ')}{/if}
                      </span>
                      <span class="details-candidate-buttons">
                        <button
                          type="button"
                          class="app-button"
                          disabled={saving}
                          on:click={() => save({ ...candidate, cover: '' })}
                        >
                          Use details
                        </button>
                        {#if candidate.cover}
                          <button
                            type="button"
                            class="app-button"
                            disabled={saving}
                            on:click={() => save(candidate)}
                          >
                            Use details and cover
                          </button>
                        {/if}
                      </span>
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
          {#if searchError}
            <p class="text-danger" role="alert">{searchError}</p>
          {/if}
        </section>
      {/if}

      {#if seriesBooks.length > 1}
        <ContinueReadingShelf
          {bookCards}
          shelfBooks={seriesBooks}
          heading={book.series}
          icon={faBookOpen}
          currentBookId={book.id}
          on:bookClick={(ev) => dispatch('showBook', ev.detail)}
          on:bookRead={(ev) => dispatch('read', ev.detail)}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .details {
    position: fixed;
    inset: 0;
    /* Above the app header (40), below dialogs (50) */
    z-index: 45;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--background-color);
    color: var(--font-color);
  }

  .details-bar {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0.6rem max(1rem, env(safe-area-inset-left));
    border-bottom: 1px solid var(--app-header-border);
    background: var(--app-header-bg);
  }

  .details-body {
    display: grid;
    gap: 2rem;
    max-width: 68rem;
    margin: 0 auto;
    padding: 2rem 1.25rem calc(3rem + env(safe-area-inset-bottom));
  }

  @media (min-width: 768px) {
    .details-body {
      grid-template-columns: 16rem minmax(0, 1fr);
      gap: 3rem;
      padding-top: 3rem;
    }

    .details-aside {
      position: sticky;
      top: 5rem;
      align-self: start;
    }
  }

  .details-aside {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  .details-cover {
    position: relative;
    width: min(13rem, 60vw);
    box-shadow: 0 0.8rem 2rem -0.8rem var(--app-cover-shadow);
  }

  @media (min-width: 768px) {
    .details-cover {
      width: 100%;
    }
  }

  .details-obi {
    position: absolute;
    right: -0.35rem;
    bottom: 9%;
    left: -0.35rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.55rem 0.5rem 0.5rem;
    background: var(--accent-color);
    box-shadow: 0 0.25rem 0.6rem -0.2rem var(--app-cover-shadow);
    color: var(--app-accent-fg);
    font-family: var(--app-font-display);
    line-height: 1.15;
    text-align: center;
  }

  .details-obi-main {
    font-size: 1.6rem;
    letter-spacing: 0.04em;
  }

  .details-obi-sub {
    min-height: 1em;
    font-size: 0.8rem;
  }

  .details-actions {
    display: flex;
    width: min(13rem, 60vw);
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (min-width: 768px) {
    .details-actions {
      width: 100%;
    }
  }

  .details-actions :global(.app-button) {
    justify-content: center;
  }

  .details-main {
    min-width: 0;
  }

  .details-title {
    font-family: var(--app-font-display);
    font-size: clamp(1.6rem, 3.5vw, 2.4rem);
    font-weight: 400;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .details-author {
    margin-top: 0.5rem;
    color: var(--app-muted-fg);
    font-size: 1.05rem;
  }

  .details-series {
    margin-top: 0.35rem;
    color: var(--accent-color);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .details-description {
    max-width: 40em;
    margin-top: 1.75rem;
    line-height: 1.8;
    white-space: pre-line;
  }

  .details-description a,
  .details-link {
    display: inline-block;
    margin-top: 0.35rem;
    color: var(--app-muted-fg);
    font-size: 0.85rem;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .details-facts {
    max-width: 40em;
    margin-top: 2rem;
  }

  .details-facts > div {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr);
    gap: 1rem;
    padding: 0.7rem 0;
    border-top: 1px solid var(--border-color);
  }

  .details-facts dt {
    color: var(--app-muted-fg);
    font-size: 0.9rem;
  }

  .details-facts dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.6rem;
  }

  .details-note {
    display: block;
    width: 100%;
    color: var(--app-muted-fg);
    font-size: 0.85rem;
  }

  .details-tags {
    display: flex;
    max-width: 40em;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 1.25rem;
  }

  .details-tags li {
    padding: 0.15rem 0.6rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    color: var(--app-muted-fg);
    font-size: 0.8rem;
  }

  .details-fetch {
    display: flex;
    max-width: 40em;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 2rem 0 2.5rem;
  }

  .details-fetch-heading {
    width: 100%;
    font-family: var(--app-font-display);
    font-size: 1.15rem;
    font-weight: 400;
  }

  .details-search {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .details-search input {
    min-width: 12rem;
    flex: 1;
  }

  .details-candidates {
    display: flex;
    width: 100%;
    flex-direction: column;
  }

  .details-candidates li {
    display: flex;
    gap: 0.9rem;
    padding: 0.8rem 0;
    border-top: 1px solid var(--border-color);
  }

  .details-candidates img,
  .details-candidate-blank {
    width: 4rem;
    flex: 0 0 auto;
    aspect-ratio: 375 / 529;
    object-fit: cover;
    background: var(--app-progress-track);
  }

  .details-candidate-text {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
  }

  .details-candidate-text a {
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .details-candidate-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.3rem;
  }
</style>
