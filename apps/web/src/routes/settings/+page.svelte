<script lang="ts">
  import { browser } from '$app/environment';
  import { replaceState } from '$app/navigation';
  import {
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faMagnifyingGlass,
    faUser
  } from '@fortawesome/free-solid-svg-icons';
  import { onDestroy, onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { map, share, tap } from 'rxjs';
  import Fa from 'svelte-fa';
  import AppHeader from '$lib/components/app-header/app-header.svelte';
  import SettingsAccount from '$lib/components/settings/settings-account.svelte';
  import SettingsPlugins from '$lib/components/settings/settings-plugins.svelte';
  import { activePlugins$, plugins } from '$lib/plugins';
  import SettingsAnki from '$lib/components/settings/settings-anki.svelte';
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
  /** Phones show the list of sections, or one area with a back button. */
  let mobileView: 'list' | 'section' = 'list';
  let collapsedAreas = new Set<string>();
  let sectionsElement: HTMLElement;
  let searchInput: HTMLInputElement;
  let scrollToMatchTimer: ReturnType<typeof setTimeout> | undefined;

  $: view.set({ area: activeArea, query });
  $: applySearch(query);
  $: searching = !!query.trim();
  // Areas of plugins that are switched off are hidden.
  $: visibleAreas = settingsAreas.filter(
    (area) =>
      !plugins.some(
        (plugin) => plugin.settingsArea === area.id && !$activePlugins$.includes(plugin)
      )
  );
  $: activeAreaInfo = settingsAreas.find((area) => area.id === activeArea) ?? settingsAreas[0];
  $: activeSectionInfo = findSettingsSection(activeSection);

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

  onDestroy(() => clearTimeout(scrollToMatchTimer));

  function toggleArea(id: string) {
    const next = new Set(collapsedAreas);

    if (!next.delete(id)) {
      next.add(id);
    }
    collapsedAreas = next;
  }

  function backToList() {
    mobileView = 'list';
    query = '';
    window.scrollTo({ top: 0 });
  }

  async function showSection(id: string, smooth = true, updateUrl = true) {
    const section = findSettingsSection(id);

    if (!section) {
      return;
    }

    query = '';
    mobileView = 'section';
    activeArea = section.area;
    if (collapsedAreas.has(section.area)) {
      collapsedAreas = new Set([...collapsedAreas].filter((area) => area !== section.area));
    }
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
        const ownMatch =
          !!needle && (item.dataset.settingsSearch || '').toLowerCase().includes(needle);
        const match = sectionMatch || ownMatch;

        item.hidden = !match;
        item.toggleAttribute('data-settings-match', ownMatch);
        visibleItems += match ? 1 : 0;
      });

      section.hidden = !sectionMatch && !visibleItems;
      visibleSections += section.hidden ? 0 : 1;
    });

    noResults = !!needle && !visibleSections;

    clearTimeout(scrollToMatchTimer);
    if (needle && !noResults) {
      // Wait for typing to pause, then bring the first match into view.
      scrollToMatchTimer = setTimeout(() => {
        const first =
          sectionsElement.querySelector<HTMLElement>('[data-settings-match]') ||
          sectionsElement.querySelector<HTMLElement>('[data-settings-section]:not([hidden])');

        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }
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

      if (!searchInput?.offsetParent) {
        mobileView = 'list';
      }

      tick().then(() => {
        searchInput?.focus();
        searchInput?.select();
      });
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
    class="settings-layout mx-auto max-w-6xl px-4 pb-28 pt-[5.25rem] md:px-8 xl:px-10 xl:pt-[4.75rem]"
    data-mobile={searching ? 'search' : mobileView}
  >
    <aside class="settings-sidebar" aria-label="Settings categories">
      <h1 class="settings-title">Settings</h1>
      <div class="settings-search" role="search">
        <Fa icon={faMagnifyingGlass} />
        <input
          bind:this={searchInput}
          bind:value={query}
          type="search"
          placeholder="Find a setting"
          aria-label="Search settings"
          aria-keyshortcuts="Control+F Meta+F"
          on:keydown={onSearchKeydown}
        />
        <span class="settings-search-shortcut" aria-hidden="true">
          <span class="keycap">Ctrl</span><span class="keycap">F</span>
        </span>
      </div>
      <nav class="settings-nav" aria-label="Settings sections">
        {#each visibleAreas as area (area.id)}
          {@const collapsed = collapsedAreas.has(area.id)}
          <div class="settings-nav-area">
            <div class="settings-nav-area-heading">
              <button
                type="button"
                class="settings-nav-area-button"
                class:settings-nav-area-active={!searching && area.id === activeArea}
                on:click={() => showSection(area.sections[0].id)}
              >
                {area.label}
              </button>
              <button
                type="button"
                class="settings-nav-collapse"
                aria-expanded={!collapsed}
                aria-label="{collapsed ? 'Show' : 'Hide'} {area.label} sections"
                on:click={() => toggleArea(area.id)}
              >
                <span class="settings-nav-chevron-down" class:settings-nav-collapsed={collapsed}
                  ><Fa icon={faChevronDown} /></span
                >
              </button>
            </div>
            {#if !collapsed}
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
                    <span class="settings-nav-chevron"><Fa icon={faChevronRight} /></span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </nav>
      <div class="settings-sync-note">
        {#if $account$}
          <span class="sync-dot" data-state={$settingsSyncState$.state} />
          <span
            class="min-w-0 truncate"
            title="Progress, statistics, reader and AI settings and themes sync to your account"
          >
            {$account$.username}
          </span>
          <button
            type="button"
            class="app-button app-button-quiet ml-auto"
            on:click={() => showSection('general-account')}
          >
            Account
          </button>
        {:else}
          <Fa icon={faUser} />
          <button
            type="button"
            class="app-button app-button-quiet"
            on:click={() => showSection('general-account')}
          >
            Sign in to sync
          </button>
        {/if}
      </div>
    </aside>

    <main class="settings-main" aria-label="Settings">
      <button type="button" class="settings-back" on:click={backToList}>
        <Fa icon={faChevronLeft} /> Settings
      </button>
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
        <div class="settings-no-results" role="status">
          <Fa icon={faMagnifyingGlass} />
          <p>No settings match “{query.trim()}”.</p>
          <button type="button" class="app-button" on:click={() => (query = '')}>
            Clear search
          </button>
        </div>
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
        <SettingsPlugins />
        {#each $activePlugins$ as plugin (plugin.id)}
          {#if plugin.settings}
            <svelte:component this={plugin.settings} />
          {/if}
        {/each}
        <SettingsAnki />
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
</div>
{$setPersistentStorage$ ?? ''}

<style>
  .settings-layout {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
  }

  .settings-title {
    font-family: var(--app-font-display);
    font-size: 1.6rem;
    font-weight: 400;
    line-height: 1.2;
  }

  .settings-search {
    display: grid;
    min-height: 2.5rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.25rem 0.5rem 0.25rem 0.75rem;
    border: 1px solid var(--app-control-border);
    border-radius: calc(0.5rem * var(--app-radius-scale));
    background: var(--app-control-bg);
    color: var(--app-text-subtle);
  }

  .settings-search:focus-within {
    border-color: var(--app-focus-ring);
    box-shadow: 0 0 0 1px var(--app-focus-ring);
  }

  .settings-search input {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--font-color);
    font-size: 0.9rem;
    outline: 0;
  }

  .settings-search-shortcut {
    display: inline-flex;
    gap: 0.2rem;
  }

  .keycap {
    display: inline-flex;
    min-width: 1.3rem;
    height: 1.3rem;
    align-items: center;
    justify-content: center;
    padding: 0 0.3rem;
    border: 1px solid var(--border-color);
    border-radius: 0.3rem;
    color: var(--app-text-subtle);
    font-size: 0.65rem;
    font-weight: 600;
    line-height: 1;
    text-transform: uppercase;
  }

  .settings-nav {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .settings-nav-area-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .settings-nav-area-button {
    padding: 0.2rem 0.5rem;
    color: var(--app-text-subtle);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .settings-nav-area-button:hover,
  .settings-nav-area-active {
    color: var(--font-color);
  }

  .settings-nav-collapse {
    display: inline-flex;
    width: 1.6rem;
    height: 1.6rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.3rem;
    color: var(--app-text-subtle);
    font-size: 0.65rem;
  }

  .settings-nav-collapse:hover {
    color: var(--font-color);
  }

  .settings-nav-chevron-down {
    display: inline-flex;
    transition: transform 0.15s ease;
  }

  .settings-nav-collapsed {
    transform: rotate(-90deg);
  }

  .settings-nav-items {
    display: grid;
    gap: 1px;
    min-width: 0;
    margin-top: 0.15rem;
  }

  .settings-nav-item {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 2rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.3rem 0.6rem;
    border-radius: calc(0.35rem * var(--app-radius-scale));
    color: var(--app-muted-fg);
    font-size: 0.88rem;
    text-align: left;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .settings-nav-item:hover {
    background: color-mix(in srgb, var(--font-color) 5%, transparent);
    color: var(--font-color);
  }

  .settings-nav-item-active,
  .settings-nav-item-active:hover {
    background: transparent;
    box-shadow: inset 2px 0 var(--accent-color);
    color: var(--font-color);
    font-weight: 600;
  }

  .settings-nav-icon {
    display: inline-flex;
    width: 0.9rem;
    flex: 0 0 auto;
    justify-content: center;
    color: var(--app-text-subtle);
    font-size: 0.8rem;
  }

  .settings-nav-item-active .settings-nav-icon {
    color: var(--accent-color);
  }

  .settings-nav-item > span:nth-child(2) {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .settings-nav-chevron {
    display: none;
    color: var(--app-text-subtle);
    font-size: 0.7rem;
  }

  .settings-sync-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
    color: var(--app-muted-fg);
    font-size: 0.8rem;
  }

  .sync-dot {
    width: 0.45rem;
    height: 0.45rem;
    flex: 0 0 auto;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--font-color) 26%, transparent);
  }

  .sync-dot[data-state='syncing'] {
    background: var(--app-warning-color);
  }

  .sync-dot[data-state='synced'] {
    background: var(--app-success-color);
  }

  .sync-dot[data-state='error'] {
    background: var(--app-danger-color);
  }

  .settings-main {
    display: flex;
    min-width: 0;
    max-width: 45rem;
    flex-direction: column;
    gap: 0.5rem;
  }

  .settings-back {
    display: none;
    align-items: center;
    gap: 0.5rem;
    align-self: flex-start;
    padding: 0.4rem 0;
    color: var(--accent-strong-color);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .settings-breadcrumb {
    display: flex;
    min-height: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    color: var(--app-text-subtle);
    font-size: 0.78rem;
  }

  .settings-no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 2.5rem 1rem;
    border: 1px dashed var(--border-color);
    border-radius: calc(0.6rem * var(--app-radius-scale));
    color: var(--app-muted-fg);
    text-align: center;
  }

  /* Sections come from several components; CSS order keeps the sidebar's order. */
  .settings-sections {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3rem;
  }

  .settings-sections :global([data-settings-section][hidden]),
  .settings-sections :global([data-settings-item][hidden]) {
    display: none;
  }

  /* Phones: a list of sections that drills into one area, with a back button */
  @media (max-width: 899px) {
    .settings-layout[data-mobile='list'] .settings-main,
    .settings-layout[data-mobile='section'] .settings-sidebar,
    .settings-layout[data-mobile='search'] .settings-nav,
    .settings-layout[data-mobile='search'] .settings-sync-note {
      display: none;
    }

    .settings-sidebar {
      display: grid;
      gap: 1rem;
    }

    .settings-layout[data-mobile='section'] .settings-back {
      display: inline-flex;
    }

    .settings-nav-items {
      border-top: 1px solid var(--border-color);
    }

    .settings-nav-item {
      min-height: 3rem;
      border-bottom: 1px solid var(--border-color);
      border-radius: 0;
      font-size: 0.95rem;
    }

    .settings-nav-item-active,
    .settings-nav-item-active:hover {
      box-shadow: none;
      font-weight: 400;
    }

    .settings-nav-chevron {
      display: inline-flex;
    }
  }

  @media (min-width: 900px) {
    .settings-layout {
      grid-template-columns: 14rem minmax(0, 1fr);
      align-items: start;
      gap: 3rem;
      padding-bottom: 3rem;
    }

    .settings-sidebar {
      position: sticky;
      top: 5.25rem;
      display: grid;
      max-height: calc(100dvh - 6.5rem);
      align-content: start;
      gap: 1rem;
      overflow-y: auto;
      padding: 0.25rem 0.25rem 1.25rem 0;
      scrollbar-width: thin;
    }
  }

  @media (min-width: 1280px) {
    .settings-sidebar {
      top: 4.75rem;
      max-height: calc(100dvh - 6rem);
    }
  }
</style>
