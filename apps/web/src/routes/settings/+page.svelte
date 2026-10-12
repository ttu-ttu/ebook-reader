<script lang="ts">
  import { browser } from '$app/environment';
  import { replaceState } from '$app/navigation';
  import {
    faBars,
    faMagnifyingGlass,
    faUser,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import { onDestroy, onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { map, share, tap } from 'rxjs';
  import Fa from 'svelte-fa';
  import AppHeader from '$lib/components/app-header/app-header.svelte';
  import SettingsAccount from '$lib/components/settings/settings-account.svelte';
  import SettingsAi from '$lib/components/settings/settings-ai.svelte';
  import SettingsContent from '$lib/components/settings/settings-content.svelte';
  import SettingsSection from '$lib/components/settings/settings-section.svelte';
  import {
    findSettingsSection,
    isFirstSectionOfArea,
    sectionFromUrl,
    setSettingsView,
    settingsAreas,
    type SettingsView
  } from '$lib/components/settings/settings-sections';
  import SettingsThemeMode from '$lib/components/settings/settings-theme-mode.svelte';
  import SettingsThemes from '$lib/components/settings/settings-themes.svelte';
  import { account$ } from '$lib/data/account';
  import { settingsSyncState$ } from '$lib/data/account-settings-sync';
  import {
    addCharactersOnCompletion$,
    adjustStatisticsAfterIdleTime$,
    autoBookmark$,
    autoBookmarkTime$,
    autoPositionOnResize$,
    autoReplication$,
    avoidPageBreak$,
    cacheStorageData$,
    confirmClose$,
    customReadingPointEnabled$,
    database,
    disableWheelNavigation$,
    enableFontVPAL$,
    enableReaderWakeLock$,
    enableTapEdgeToFlip$,
    enableTextJustification$,
    enableTextWrapPretty$,
    enableVerticalFontKerning$,
    firstDimensionMargin$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    fontWeight$,
    furiganaStyle$,
    hideExternalReadHint$,
    hideFurigana$,
    hideSpoilerImage$,
    importHTMLFixMode$,
    lineHeight$,
    manualBookmark$,
    keepLocalStatisticsOnDeletion$,
    openTrackerOnCompletion$,
    overwriteBookCompletion$,
    pageColumns$,
    pauseTrackerOnCustomPointChange$,
    prioritizeReaderStyles$,
    replicationSaveBehavior$,
    restrictImportFixToAnchor$,
    secondDimensionMaxValue$,
    selectionToBookmarkEnabled$,
    showCharacterCounter$,
    showPercentage$,
    showFooterChapterCharacterCounter$,
    showFooterChapterPercentage$,
    showExternalPlaceholder$,
    startDayHoursForTracker$,
    statisticsEnabled$,
    statisticsMergeMode$,
    swipeThreshold$,
    textIndentation$,
    textMarginMode$,
    textMarginValue$,
    trackerAutoPause$,
    trackerBackwardSkipThreshold$,
    trackerForwardSkipThreshold$,
    trackerAutostartTime$,
    trackerIdleTime$,
    trackerPopupDetection$,
    trackerSkipThresholdAction$,
    verticalTextOrientation$,
    viewMode$,
    writingMode$,
    readingGoalsMergeMode$,
    hideSpoilerImageMode$
  } from '$lib/data/store';
  import { storage } from '$lib/data/window/navigator/storage';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { writableSubject } from '$lib/functions/svelte/store';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';

  const persistentStorage$ = writableSubject(false);
  let persistentStorageReactive = false;

  /** A section counts as current once its top is this close to the viewport top. */
  const currentSectionOffsetPx = 140;
  const view = writable<SettingsView>({ area: settingsAreas[0].id, query: '' });

  setSettingsView(view);

  let activeArea = settingsAreas[0].id;
  let activeSection = settingsAreas[0].sections[0].id;
  let query = '';
  let noResults = false;
  let mobileMenuOpen = false;
  let sectionsElement: HTMLElement;
  let searchInput: HTMLInputElement;
  let mobileSearchInput: HTMLInputElement;

  $: view.set({ area: activeArea, query });
  $: applySearch(query);
  $: searching = !!query.trim();
  $: activeAreaInfo = settingsAreas.find((area) => area.id === activeArea) ?? settingsAreas[0];
  $: activeSectionInfo = findSettingsSection(activeSection);

  $: if (browser) {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
  }

  onMount(() => {
    const requested = sectionFromUrl(new URL(window.location.href));

    if (requested) {
      // The URL already names the section, and SvelteKit's router isn't ready
      // during the first onMount (replaceState threw, so the scroll never ran).
      showSection(requested.id, false, false);
    }

    storage.persisted().then(setPersistentStorage);

    setStorageQuota();
  });

  onDestroy(() => {
    if (browser) {
      document.body.style.overflow = '';
    }
  });

  async function showSection(id: string, smooth = true, updateUrl = true) {
    const section = findSettingsSection(id);

    if (!section) {
      return;
    }

    query = '';
    mobileMenuOpen = false;
    activeArea = section.area;
    activeSection = section.id;
    if (updateUrl) {
      replaceState(`?section=${section.area}#${section.id}`, {});
    }

    await tick();

    const behavior = smooth ? 'smooth' : 'auto';
    const element = document.getElementById(section.id);

    if (element && !isFirstSectionOfArea(section.id)) {
      element.scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }

  /** Hides settings that don't match the search; sections match by title too. */
  async function applySearch(text: string) {
    await tick();

    if (!sectionsElement) {
      return;
    }

    const needle = text.trim().toLowerCase();
    let visibleSections = 0;

    sectionsElement.querySelectorAll<HTMLElement>('[data-settings-section]').forEach((section) => {
      const sectionMatch =
        !needle || (section.dataset.settingsSearch || '').toLowerCase().includes(needle);
      let visibleItems = 0;

      section.querySelectorAll<HTMLElement>('[data-settings-item]').forEach((item) => {
        const match =
          sectionMatch || (item.dataset.settingsSearch || '').toLowerCase().includes(needle);

        item.hidden = !match;
        visibleItems += match ? 1 : 0;
      });

      section.hidden = !sectionMatch && !visibleItems;
      visibleSections += section.hidden ? 0 : 1;
    });

    noResults = !!needle && !visibleSections;
  }

  /** Highlights the section being read in the sidebar. */
  function onScroll() {
    if (searching) {
      return;
    }

    const ids = activeAreaInfo.sections.map((section) => section.id);
    const reached = ids.filter(
      (id) =>
        (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <=
        currentSectionOffsetPx
    );

    activeSection = reached[reached.length - 1] || ids[0];
  }

  function onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();

      const input = searchInput?.offsetParent ? searchInput : mobileSearchInput;

      input?.focus();
      input?.select();
    }
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      query = '';
      (event.currentTarget as HTMLElement).blur();
    }
  }

  const currentBookId$ = database.lastItem$.pipe(
    map((item) => item?.dataId),
    share()
  );

  let storageQuota = '';

  const setPersistentStorage$ = persistentStorage$.pipe(
    tap((value) => {
      if (!persistentStorageReactive) return;
      if (!value) {
        setPersistentStorage(true);
        return;
      }

      storage.persist().then(setPersistentStorage).finally(setStorageQuota);
    }),
    reduceToEmptyString()
  );

  function setPersistentStorage(value: boolean) {
    persistentStorageReactive = false;
    persistentStorage$.next(value);
    persistentStorageReactive = true;
  }

  function setStorageQuota() {
    storage
      .estimate()
      .then((storageData) => {
        const { usage, quota } = storageData;

        if (usage === undefined || quota === undefined) {
          return;
        }

        storageQuota = `${Math.round(((usage / quota) * 100 + Number.EPSILON) * 100) / 100} % used`;
      })
      .catch(() => {
        // no-op
      });
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Settings')}</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} on:scroll={onScroll} />

<div class="app-page-shell">
  <AppHeader active="settings" currentBookId={$currentBookId$} />

  <div
    class="settings-layout mx-auto max-w-7xl px-4 pb-28 pt-[5.25rem] md:px-8 xl:px-10 xl:pt-[4.75rem]"
  >
    <aside class="settings-sidebar" aria-label="Settings categories">
      <h1 class="settings-title">Settings</h1>
      <div class="settings-search" role="search">
        <Fa icon={faMagnifyingGlass} class="opacity-70" />
        <input
          bind:this={searchInput}
          bind:value={query}
          type="search"
          placeholder="Find..."
          aria-label="Search settings"
          aria-keyshortcuts="Control+F Meta+F"
          on:keydown={onSearchKeydown}
        />
        <span class="settings-search-shortcut" aria-hidden="true">
          <span class="keycap">Ctrl</span><span class="keycap">F</span>
        </span>
      </div>
      <nav class="settings-nav" aria-label="Settings sections">
        {#each settingsAreas as area (area.id)}
          <div class="settings-nav-area">
            <button
              type="button"
              class="settings-nav-area-button"
              class:settings-nav-area-active={!searching && area.id === activeArea}
              aria-pressed={!searching && area.id === activeArea}
              on:click={() => showSection(area.sections[0].id)}
            >
              <span class="settings-nav-icon"><Fa icon={area.icon} /></span>
              <span>{area.label}</span>
            </button>
            <div class="settings-nav-items">
              {#each area.sections as section (section.id)}
                <button
                  type="button"
                  class="settings-nav-item"
                  class:settings-nav-item-active={!searching && section.id === activeSection}
                  aria-current={!searching && section.id === activeSection ? 'page' : undefined}
                  on:click={() => showSection(section.id)}
                >
                  <span class="settings-nav-icon"><Fa icon={section.icon} /></span>
                  <span>{section.label}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </nav>
      <div class="settings-sync-note">
        {#if $account$}
          <span class="sync-dot" data-state={$settingsSyncState$.state} />
          <span>
            Signed in as {$account$.username}. Progress, statistics, reader and AI settings and
            themes sync to your account.
          </span>
        {:else}
          <button
            type="button"
            class="text-left"
            on:click={() => showSection('general-account')}
          >
            <Fa icon={faUser} class="mr-1 inline" />
            Sign in to sync progress, statistics, reader and AI settings and themes.
          </button>
        {/if}
      </div>
    </aside>

    <main class="settings-main" aria-label="Settings">
      <h1 class="settings-title settings-title-mobile">Settings</h1>
      <div class="settings-breadcrumb" aria-live="polite">
        {#if searching}
          <span>Results for “{query.trim()}”</span>
        {:else}
          <span>{activeAreaInfo.label}</span>
          {#if activeSectionInfo}
            <span class="opacity-50">›</span>
            <span>{activeSectionInfo.label}</span>
          {/if}
        {/if}
      </div>
      {#if noResults}
        <p class="settings-no-results">No settings match “{query.trim()}”.</p>
      {/if}
      <div class="settings-sections" bind:this={sectionsElement}>
        <SettingsSection id="general-account">
          <SettingsAccount />
        </SettingsSection>
        <SettingsSection id="general-theme">
          <SettingsThemeMode />
        </SettingsSection>
        <SettingsSection
          id="general-custom-themes"
          keywords="editor colors colours import export json css font roundness blur"
          wide
        >
          <SettingsThemes />
        </SettingsSection>
        <SettingsAi />
        <SettingsContent
          {storageQuota}
          bind:fontFamilyGroupOne={$fontFamilyGroupOne$}
          bind:fontFamilyGroupTwo={$fontFamilyGroupTwo$}
          bind:fontWeight={$fontWeight$}
          bind:fontSize={$fontSize$}
          bind:lineHeight={$lineHeight$}
          bind:textIndentation={$textIndentation$}
          bind:textMarginValue={$textMarginValue$}
          bind:blurImage={$hideSpoilerImage$}
          bind:blurImageMode={$hideSpoilerImageMode$}
          bind:hideFurigana={$hideFurigana$}
          bind:furiganaStyle={$furiganaStyle$}
          bind:writingMode={$writingMode$}
          bind:enableFontKerning={$enableVerticalFontKerning$}
          bind:enableFontVPAL={$enableFontVPAL$}
          bind:verticalTextOrientation={$verticalTextOrientation$}
          bind:prioritizeReaderStyles={$prioritizeReaderStyles$}
          bind:enableTextJustification={$enableTextJustification$}
          bind:enableTextWrapPretty={$enableTextWrapPretty$}
          bind:textMarginMode={$textMarginMode$}
          bind:enableReaderWakeLock={$enableReaderWakeLock$}
          bind:showCharacterCounter={$showCharacterCounter$}
          bind:showPercentage={$showPercentage$}
          bind:showFooterChapterCharacterCounter={$showFooterChapterCharacterCounter$}
          bind:showFooterChapterPercentage={$showFooterChapterPercentage$}
          bind:viewMode={$viewMode$}
          bind:secondDimensionMaxValue={$secondDimensionMaxValue$}
          bind:firstDimensionMargin={$firstDimensionMargin$}
          bind:swipeThreshold={$swipeThreshold$}
          bind:disableWheelNavigation={$disableWheelNavigation$}
          bind:autoPositionOnResize={$autoPositionOnResize$}
          bind:avoidPageBreak={$avoidPageBreak$}
          bind:pauseTrackerOnCustomPointChange={$pauseTrackerOnCustomPointChange$}
          bind:customReadingPointEnabled={$customReadingPointEnabled$}
          bind:selectionToBookmarkEnabled={$selectionToBookmarkEnabled$}
          bind:enableTapEdgeToFlip={$enableTapEdgeToFlip$}
          bind:pageColumns={$pageColumns$}
          bind:persistentStorage={$persistentStorage$}
          bind:hideExternalReadHint={$hideExternalReadHint$}
          bind:confirmClose={$confirmClose$}
          bind:manualBookmark={$manualBookmark$}
          bind:autoBookmark={$autoBookmark$}
          bind:autoBookmarkTime={$autoBookmarkTime$}
          bind:importHTMLFixMode={$importHTMLFixMode$}
          bind:restrictImportFixToAnchor={$restrictImportFixToAnchor$}
          bind:cacheStorageData={$cacheStorageData$}
          bind:replicationSaveBehavior={$replicationSaveBehavior$}
          bind:autoReplication={$autoReplication$}
          bind:showExternalPlaceholder={$showExternalPlaceholder$}
          bind:keepLocalStatisticsOnDeletion={$keepLocalStatisticsOnDeletion$}
          bind:overwriteBookCompletion={$overwriteBookCompletion$}
          bind:startDayHoursForTracker={$startDayHoursForTracker$}
          bind:statisticsMergeMode={$statisticsMergeMode$}
          bind:readingGoalsMergeMode={$readingGoalsMergeMode$}
          bind:statisticsEnabled={$statisticsEnabled$}
          bind:trackerAutoPause={$trackerAutoPause$}
          bind:openTrackerOnCompletion={$openTrackerOnCompletion$}
          bind:addCharactersOnCompletion={$addCharactersOnCompletion$}
          bind:trackerAutoStartTime={$trackerAutostartTime$}
          bind:trackerIdleTime={$trackerIdleTime$}
          bind:trackerForwardSkipThreshold={$trackerForwardSkipThreshold$}
          bind:trackerBackwardSkipThreshold={$trackerBackwardSkipThreshold$}
          bind:trackerSkipThresholdAction={$trackerSkipThresholdAction$}
          bind:trackerPopupDetection={$trackerPopupDetection$}
          bind:adjustStatisticsAfterIdleTime={$adjustStatisticsAfterIdleTime$}
        />
      </div>
    </main>
  </div>

  <div class="settings-mobile-controls">
    <label class="settings-mobile-search">
      <Fa icon={faMagnifyingGlass} />
      <input
        bind:this={mobileSearchInput}
        bind:value={query}
        type="search"
        placeholder="Find..."
        aria-label="Search settings"
        on:keydown={onSearchKeydown}
      />
    </label>
    <span class="settings-mobile-divider" />
    <button
      type="button"
      class="settings-mobile-menu-button"
      aria-label="Open settings category menu"
      aria-expanded={mobileMenuOpen}
      on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
    >
      <Fa icon={mobileMenuOpen ? faXmark : faBars} />
    </button>
  </div>

  {#if mobileMenuOpen}
    <button
      type="button"
      class="settings-mobile-backdrop"
      aria-label="Close menu"
      on:click={() => (mobileMenuOpen = false)}
    />
    <nav class="settings-mobile-sheet" aria-label="Settings sections">
      {#each settingsAreas as area (area.id)}
        <div class="settings-nav-area">
          <div class="settings-nav-area-button settings-nav-area-active">
            <span class="settings-nav-icon"><Fa icon={area.icon} /></span>
            <span>{area.label}</span>
          </div>
          <div class="settings-nav-items">
            {#each area.sections as section (section.id)}
              <button
                type="button"
                class="settings-nav-item"
                class:settings-nav-item-active={section.id === activeSection}
                on:click={() => showSection(section.id)}
              >
                <span class="settings-nav-icon"><Fa icon={section.icon} /></span>
                <span>{section.label}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </nav>
  {/if}
</div>
{$setPersistentStorage$ ?? ''}

<style>
  .settings-layout {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
  }

  .settings-sidebar {
    display: none;
  }

  .settings-title {
    font-size: 1.35rem;
    font-weight: 780;
    line-height: 1.1;
  }

  .settings-title-mobile {
    margin-top: 0.75rem;
  }

  .settings-search {
    display: grid;
    min-height: 2.75rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    padding: 0.4rem 0.6rem 0.4rem 0.8rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
    border-radius: calc(1rem * var(--app-radius-scale));
    background: color-mix(in srgb, var(--surface-color) 92%, var(--background-color));
    box-shadow:
      0 1px 2px color-mix(in srgb, var(--shadow-color) 8%, transparent),
      inset 0 1px color-mix(in srgb, var(--app-inset-highlight) 35%, transparent);
    color: var(--app-muted-fg);
  }

  .settings-search input,
  .settings-mobile-search input {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--font-color);
    font-size: 0.95rem;
    outline: 0;
  }

  .settings-search-shortcut {
    display: inline-flex;
    gap: 0.25rem;
  }

  .keycap {
    display: inline-flex;
    min-width: 1.45rem;
    height: 1.45rem;
    align-items: center;
    justify-content: center;
    padding: 0 0.42rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 18%, var(--border-color));
    border-radius: 0.42rem;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--font-color) 10%, var(--surface-strong-color)),
      color-mix(in srgb, var(--font-color) 6%, var(--surface-color))
    );
    box-shadow: 0 1px color-mix(in srgb, var(--shadow-color) 100%, transparent);
    color: color-mix(in srgb, var(--font-color) 86%, transparent);
    font-size: 0.72rem;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
  }

  .settings-nav,
  .settings-mobile-sheet {
    display: grid;
    gap: 0.85rem;
    min-width: 0;
  }

  .settings-nav-area {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }

  .settings-nav-area-button,
  .settings-nav-item {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    gap: 0.55rem;
    border-radius: calc(0.75rem * var(--app-radius-scale));
    color: color-mix(in srgb, var(--font-color) 68%, transparent);
    text-align: left;
    transition:
      background-color 0.16s ease,
      color 0.16s ease;
  }

  .settings-nav-area-button {
    min-height: 2.1rem;
    padding: 0.35rem 0.55rem;
    font-size: 0.78rem;
    font-weight: 780;
  }

  .settings-nav-area-active {
    color: var(--font-color);
  }

  .settings-nav-items {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
    margin-left: 0.62rem;
    padding-left: 0.45rem;
    border-left: 1px solid color-mix(in srgb, var(--font-color) 8%, transparent);
  }

  .settings-nav-item {
    min-height: 2.38rem;
    padding: 0.48rem 0.65rem;
    font-size: 0.93rem;
    font-weight: 720;
  }

  button.settings-nav-area-button:hover,
  .settings-nav-item:hover {
    background: color-mix(in srgb, var(--font-color) 5%, transparent);
    color: var(--font-color);
  }

  .settings-nav-item-active,
  .settings-nav-item-active:hover {
    background: color-mix(in srgb, var(--accent-color) 13%, var(--surface-color));
    color: var(--font-color);
    font-weight: 780;
  }

  .settings-nav-icon {
    display: inline-flex;
    width: 0.95rem;
    flex: 0 0 auto;
    justify-content: center;
    color: color-mix(in srgb, var(--accent-color) 58%, var(--font-color));
  }

  .settings-nav-area-button > span:last-child,
  .settings-nav-item > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .settings-sync-note {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding-top: 0.8rem;
    border-top: 1px solid color-mix(in srgb, var(--font-color) 7%, transparent);
    color: color-mix(in srgb, var(--font-color) 58%, transparent);
    font-size: 0.82rem;
    font-weight: 650;
    line-height: 1.35;
  }

  .sync-dot {
    width: 0.48rem;
    height: 0.48rem;
    flex: 0 0 auto;
    margin-top: 0.35rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--font-color) 26%, transparent);
  }

  .sync-dot[data-state='syncing'] {
    background: var(--app-warning-color);
  }

  .sync-dot[data-state='synced'] {
    background: var(--app-success-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-success-color) 18%, transparent);
  }

  .sync-dot[data-state='error'] {
    background: var(--app-danger-color);
  }

  .settings-main {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.65rem;
  }

  .settings-breadcrumb {
    display: flex;
    min-height: 2rem;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.42rem;
    color: color-mix(in srgb, var(--font-color) 62%, transparent);
    font-size: 0.9rem;
    font-weight: 760;
  }

  .settings-breadcrumb span:last-child {
    color: var(--font-color);
  }

  .settings-no-results {
    padding: 0.85rem 1rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 7%, var(--border-color));
    border-radius: calc(1rem * var(--app-radius-scale));
    color: color-mix(in srgb, var(--font-color) 70%, transparent);
    font-size: 0.9rem;
  }

  /* Sections come from several components; CSS order keeps the sidebar's order. */
  .settings-sections {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2.25rem;
  }

  .settings-sections :global([data-settings-section][hidden]),
  .settings-sections :global([data-settings-item][hidden]) {
    display: none;
  }

  .settings-mobile-controls {
    position: fixed;
    bottom: max(0.8rem, env(safe-area-inset-bottom));
    left: 50%;
    z-index: 50;
    display: grid;
    width: min(17rem, calc(100vw - 2rem));
    min-height: 3.25rem;
    grid-template-columns: minmax(0, 1fr) 1px 2.65rem;
    align-items: center;
    gap: 0.65rem;
    padding: 0.25rem 0.35rem 0.25rem 0.85rem;
    transform: translate(-50%);
    border: 1px solid color-mix(in srgb, var(--font-color) 10%, var(--border-color));
    border-radius: calc(1.25rem * var(--app-radius-scale));
    background: color-mix(in srgb, var(--surface-color) 96%, var(--background-color));
    box-shadow:
      0 0.85rem 2rem color-mix(in srgb, var(--shadow-color) 16%, transparent),
      inset 0 1px color-mix(in srgb, var(--app-inset-highlight) 34%, transparent);
  }

  .settings-mobile-search {
    display: grid;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    color: color-mix(in srgb, var(--font-color) 74%, transparent);
  }

  .settings-mobile-search input {
    font-weight: 700;
  }

  .settings-mobile-divider {
    width: 1px;
    height: 2.1rem;
    background: color-mix(in srgb, var(--font-color) 12%, transparent);
  }

  .settings-mobile-menu-button {
    display: inline-flex;
    width: 2.65rem;
    height: 2.65rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.95rem;
    color: color-mix(in srgb, var(--font-color) 82%, transparent);
    font-size: 1.12rem;
  }

  .settings-mobile-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: color-mix(in srgb, var(--background-color) 70%, transparent);
  }

  .settings-mobile-sheet {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    max-height: min(78dvh, 42rem);
    overflow-y: auto;
    padding: 0.85rem 0.85rem 6rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 10%, var(--border-color));
    border-radius: 1.4rem 1.4rem 0 0;
    background: color-mix(in srgb, var(--surface-color) 98%, var(--background-color));
    box-shadow: 0 -1.1rem 2.5rem color-mix(in srgb, var(--shadow-color) 12%, transparent);
  }

  @media (min-width: 900px) {
    .settings-layout {
      grid-template-columns: 17rem minmax(0, 1fr);
      align-items: start;
    }

    .settings-sidebar {
      position: sticky;
      top: 5.25rem;
      display: grid;
      max-height: calc(100dvh - 6.5rem);
      align-content: start;
      gap: 0.85rem;
      overflow-y: auto;
      padding: 0.25rem 1rem 1.25rem 0;
      border-right: 1px solid color-mix(in srgb, var(--font-color) 7%, var(--border-color));
      scrollbar-width: thin;
    }

    .settings-title-mobile,
    .settings-mobile-controls,
    .settings-mobile-backdrop,
    .settings-mobile-sheet {
      display: none;
    }

    .settings-layout {
      padding-bottom: 3rem;
    }
  }

  @media (min-width: 1280px) {
    .settings-sidebar {
      top: 4.75rem;
      max-height: calc(100dvh - 6rem);
    }
  }
</style>
