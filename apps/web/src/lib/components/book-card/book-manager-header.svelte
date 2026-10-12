<script lang="ts">
  import { browser } from '$app/environment';
  import AppHeader from '$lib/components/app-header/app-header.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import { nextSortOption } from '$lib/components/book-card/library-sort';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import Popover from '$lib/components/popover/popover.svelte';
  import { SortDirection, type SortOption } from '$lib/data/sort-types';
  import { FilesystemStorageHandler } from '$lib/data/storage/handler/filesystem-handler';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import {
    isStorageSourceAvailable,
    storageIcon$,
    storageSource$
  } from '$lib/data/storage/storage-view';
  import {
    booklistSortOptions$,
    cacheStorageData$,
    fileCountData$,
    fsStorageSource$,
    gDriveStorageSource$,
    isOnline$,
    libraryDisplayMode$,
    oneDriveStorageSource$,
    type LibraryDisplayMode
  } from '$lib/data/store';
  import { inputAllowDirectory } from '$lib/functions/file-dom/input-allow-directory';
  import { inputFile } from '$lib/functions/file-dom/input-file';
  import { isMobile$, isOnOldUrl } from '$lib/functions/utils';
  import {
    faArrowDown,
    faBorderAll,
    faBug,
    faCheck,
    faChevronDown,
    faEllipsis,
    faFileImport,
    faGrip,
    faHashtag,
    faList,
    faSquareCheck,
    faTriangleExclamation
  } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let currentBookId: number | undefined;
  export let selectMode: boolean;
  export let hasBooks: boolean;
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    domainHintClick: void;
    bugReportClick: void;
    filesChange: FileList;
    importBackup: File;
  }>();

  const panelClasses = 'app-popover-panel';

  const displayModes: { mode: LibraryDisplayMode; label: string; icon: typeof faGrip }[] = [
    { mode: 'covers-comfortable', label: 'Covers', icon: faBorderAll },
    { mode: 'covers-compact', label: 'Compact covers', icon: faGrip },
    { mode: 'list', label: 'List', icon: faList }
  ];

  let fileImportElm: HTMLElement;
  let folderImportElm: HTMLElement;
  let backupImportElm: HTMLElement;
  let countImportElm: HTMLInputElement;
  let importMenuElm: Popover;
  let storageSourceElm: Popover;
  let displayMenuElm: Popover;
  let moreMenuElm: Popover;
  let isOldUrl = false;
  let showLoadCount = false;

  $: if (browser) {
    isOldUrl = isOnOldUrl(window);
    showLoadCount = new URLSearchParams(window.location.search).has('count');
  }

  $: importMenuItems = [
    mergeEntries.FILE_IMPORT,
    ...($isMobile$ ? [] : [mergeEntries.FOLDER_IMPORT]),
    mergeEntries.BACKUP_IMPORT
  ];

  $: storageSourceMenuItems = browser
    ? [
        { label: 'Calibre', key: StorageKey.CALIBRE, requiresConnectivity: false },
        { label: 'Browser', key: StorageKey.BROWSER, requiresConnectivity: false },
        ...(isStorageSourceAvailable(StorageKey.GDRIVE, $gDriveStorageSource$, window)
          ? [{ label: 'GDrive', key: StorageKey.GDRIVE, requiresConnectivity: true }]
          : []),
        ...(isStorageSourceAvailable(StorageKey.ONEDRIVE, $oneDriveStorageSource$, window)
          ? [{ label: 'OneDrive', key: StorageKey.ONEDRIVE, requiresConnectivity: true }]
          : []),
        ...(isStorageSourceAvailable(StorageKey.FS, $fsStorageSource$, window)
          ? [{ label: 'Filesystem', key: StorageKey.FS, requiresConnectivity: false }]
          : [])
      ]
    : [];

  $: sortMenuItems = [
    ...($storageSource$ === StorageKey.BROWSER
      ? [{ property: 'id' as SortOption['property'], label: 'Date added' }]
      : []),
    { property: 'title' as SortOption['property'], label: 'Title' },
    { property: 'series' as SortOption['property'], label: 'Series' },
    { property: 'difficulty' as SortOption['property'], label: 'Difficulty' },
    { property: 'progress' as SortOption['property'], label: 'Progress' },
    { property: 'characters' as SortOption['property'], label: 'Characters' },
    { property: 'lastBookOpen' as SortOption['property'], label: 'Last read' },
    { property: 'lastBookmarkModified' as SortOption['property'], label: 'Bookmarked' },
    { property: 'lastBookModified' as SortOption['property'], label: 'Last update' }
  ];

  $: currentSort = $booklistSortOptions$[$storageSource$];

  function triggerImport(label: string) {
    switch (label) {
      case mergeEntries.FOLDER_IMPORT.label:
        folderImportElm.click();
        break;

      case mergeEntries.BACKUP_IMPORT.label:
        backupImportElm.click();
        break;

      default:
        fileImportElm.click();
        break;
    }

    importMenuElm.toggleOpen();
  }

  function dispatchFilesChange(fileList: FileList) {
    dispatch('filesChange', fileList);
  }

  function dispatchImportBackup(fileList: FileList) {
    dispatch('importBackup', fileList[0]);
  }

  async function setCountData(fileList: FileList) {
    try {
      $fileCountData$ = JSON.parse(await FilesystemStorageHandler.readFileObject(fileList[0]));
    } catch ({ message }: any) {
      console.error(`failed to read file: ${message}`);
    }
  }

  function changeSort(property: SortOption['property']) {
    booklistSortOptions$.next({
      ...$booklistSortOptions$,
      [$storageSource$]: nextSortOption(currentSort, property)
    });
  }

  function onKeydown(event: KeyboardEvent) {
    if (
      event.key.toLowerCase() !== 'q' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.repeat ||
      disabled
    ) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    event.preventDefault();
    displayMenuElm.toggleOpen();
  }

  function runMoreAction(action: () => void) {
    moreMenuElm.toggleOpen();
    action();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<input
  hidden
  multiple
  type="file"
  accept="application/epub+zip,.epub,.htmlz,plain/text,.txt,.cbz,.zip"
  use:inputFile={dispatchFilesChange}
  bind:this={fileImportElm}
/>
<input
  hidden
  multiple
  type="file"
  use:inputAllowDirectory
  use:inputFile={dispatchFilesChange}
  bind:this={folderImportElm}
/>
<input
  hidden
  type="file"
  accept=".zip,application/zip"
  use:inputFile={dispatchImportBackup}
  bind:this={backupImportElm}
/>
<input
  hidden
  type="file"
  accept=".json,application/json"
  use:inputFile={setCountData}
  bind:this={countImportElm}
/>

<AppHeader active="library" {currentBookId}>
  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom', 'bottom-start']}
    yOffset={10}
    {panelClasses}
    bind:this={importMenuElm}
  >
    <button
      slot="icon"
      type="button"
      class="app-header-icon app-header-icon-label"
      title="Import books"
      {disabled}
    >
      <Fa icon={faFileImport} />
      <span class="hidden md:inline">Import</span>
      <Fa icon={faChevronDown} size="xs" class="hidden opacity-70 md:block" />
    </button>
    <div slot="content" class="flex flex-col">
      {#each importMenuItems as item (item.label)}
        <button type="button" class="app-popover-item" on:click={() => triggerImport(item.label)}>
          <Fa icon={item.icon} fw />
          {item.label}
        </button>
      {/each}
    </div>
  </Popover>

  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom', 'bottom-start']}
    yOffset={10}
    {panelClasses}
    bind:this={storageSourceElm}
  >
    <button
      slot="icon"
      type="button"
      class="app-header-icon"
      title="Select storage source"
      aria-label="Select storage source"
      {disabled}
    >
      {#key $storageIcon$}
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox={$storageIcon$.viewBox}>
          <path class="fill-current" d={$storageIcon$.d} />
        </svg>
      {/key}
    </button>
    <div slot="content" class="flex flex-col">
      <div class="app-popover-heading">Storage source</div>
      {#each storageSourceMenuItems as sourceMenuItem (sourceMenuItem.key)}
        <button
          type="button"
          class="app-popover-item"
          class:app-popover-item-active={sourceMenuItem.key === $storageSource$}
          disabled={sourceMenuItem.requiresConnectivity && !$isOnline$}
          on:click={() => {
            if (sourceMenuItem.key !== $storageSource$) {
              if (!$cacheStorageData$) {
                getStorageHandler(window, sourceMenuItem.key).clearData();
              }

              storageSource$.next(sourceMenuItem.key);
            }

            storageSourceElm.toggleOpen();
          }}
        >
          <span class="flex-1">{sourceMenuItem.label}</span>
          {#if sourceMenuItem.key === $storageSource$}<Fa icon={faCheck} />{/if}
        </button>
      {/each}
    </div>
  </Popover>

  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom', 'bottom-start']}
    yOffset={10}
    {panelClasses}
    bind:this={displayMenuElm}
  >
    <button
      slot="icon"
      type="button"
      class="app-header-icon"
      title="Display settings (Q)"
      aria-label="Open library display settings"
      aria-keyshortcuts="Q"
      {disabled}
    >
      <Fa icon={displayModes.find((d) => d.mode === $libraryDisplayMode$)?.icon ?? faBorderAll} />
    </button>
    <div slot="content" class="flex w-60 flex-col">
      <div class="app-popover-heading">View</div>
      <div class="grid grid-cols-3 gap-1 px-1 pb-1">
        {#each displayModes as displayMode (displayMode.mode)}
          <button
            type="button"
            class="app-popover-item flex-col justify-center gap-1 text-xs"
            class:app-popover-item-active={$libraryDisplayMode$ === displayMode.mode}
            aria-pressed={$libraryDisplayMode$ === displayMode.mode}
            on:click={() => ($libraryDisplayMode$ = displayMode.mode)}
          >
            <Fa icon={displayMode.icon} />
            <span class="text-center leading-tight">{displayMode.label}</span>
          </button>
        {/each}
      </div>
      <div class="app-popover-heading">Sort by</div>
      {#each sortMenuItems as sortMenuItem (sortMenuItem.property)}
        {@const isCurrent = currentSort.property === sortMenuItem.property}
        <button
          type="button"
          class="app-popover-item"
          class:app-popover-item-active={isCurrent}
          on:click={() => changeSort(sortMenuItem.property)}
        >
          <span class="flex-1">{sortMenuItem.label}</span>
          {#if isCurrent}
            <span
              class="inline-flex text-xs transition-transform"
              class:rotate-180={currentSort.direction === SortDirection.ASC}
              title={currentSort.direction === SortDirection.ASC ? 'Ascending' : 'Descending'}
            >
              <Fa icon={faArrowDown} />
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </Popover>

  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom', 'bottom-start']}
    yOffset={10}
    {panelClasses}
    bind:this={moreMenuElm}
  >
    <button
      slot="icon"
      type="button"
      class="app-header-icon"
      title="More options"
      aria-label="More options"
      {disabled}
    >
      <Fa icon={faEllipsis} />
    </button>
    <div slot="content" class="flex w-56 flex-col">
      <button
        type="button"
        class="app-popover-item"
        class:app-popover-item-active={selectMode}
        disabled={!hasBooks}
        on:click={() => runMoreAction(() => (selectMode = !selectMode))}
      >
        <Fa icon={faSquareCheck} fw />
        {selectMode ? 'Stop selecting' : 'Select books'}
      </button>
      <button
        type="button"
        class="app-popover-item"
        on:click={() => runMoreAction(() => dispatch('bugReportClick'))}
      >
        <Fa icon={faBug} fw />
        Report an issue
      </button>
      {#if isOldUrl}
        <button
          type="button"
          class="app-popover-item"
          on:click={() => runMoreAction(() => dispatch('domainHintClick'))}
        >
          <Fa icon={faTriangleExclamation} fw />
          Old domain hint
        </button>
      {/if}
      {#if showLoadCount}
        <button
          type="button"
          class="app-popover-item"
          class:app-popover-item-active={!!$fileCountData$}
          on:click={() => runMoreAction(() => countImportElm.click())}
        >
          <Fa icon={faHashtag} fw />
          Load character counts
        </button>
      {/if}
    </div>
  </Popover>
</AppHeader>
