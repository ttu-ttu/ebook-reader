<script lang="ts">
  import { browser } from '$app/environment';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Popover from '$lib/components/popover/popover.svelte';
  import { IconButton, Tooltip, TopBar } from '@custom-ereader/ui';
  import { SortDirection } from '$lib/data/sort-types';
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
    oneDriveStorageSource$
  } from '$lib/data/store';
  import { inputAllowDirectory } from '$lib/functions/file-dom/input-allow-directory';
  import { inputFile } from '$lib/functions/file-dom/input-file';
  import { dummyFn, isMobile$, isOnOldUrl } from '$lib/functions/utils';
  import {
    faArrowDownShortWide,
    faArrowDownWideShort,
    faCalendarXmark,
    faChartLine,
    faCircleXmark,
    faCloudArrowUp,
    faSortDown,
    faSortUp,
    faTimes,
    faTrash
  } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let hasBookOpened: boolean;
  export let selectMode: boolean;
  export let selectedCount: number;
  export let hasBooks: boolean;
  export let cancelTooltip: string;
  export let replicationProgress: number;
  export let replicationToProgress: number;
  export let replicationProgressRemaining: string;

  const dispatch = createEventDispatcher<{
    selectAllClick: void;
    removeClick: void;
    domainHintClick: void;
    bugReportClick: void;
    backToBookClick: void;
    filesChange: FileList;
    importBackup: File;
    selectionToStatistics: void;
    deleteStatistics: void;
    replicateData: void;
    cancelReplication: void;
  }>();

  const importMenuItems = [mergeEntries.FILE_IMPORT];
  const storageSourceMenuItems = [
    { label: 'Browser', key: StorageKey.BROWSER, requiresConnectivity: false }
  ];

  let fileImportElm: HTMLElement;
  let folderImportElm: HTMLElement;
  let backupImportElm: HTMLElement;
  let countImportElm: HTMLInputElement;
  let storageSourceElm: Popover;
  let sortOptionsElm: Popover;
  let isOldUrl = false;
  let showLoadCount = false;

  $: if (browser) {
    isOldUrl = isOnOldUrl(window);
    showLoadCount = new URLSearchParams(window.location.search).has('count');

    importMenuItems.push(
      ...($isMobile$
        ? [mergeEntries.BACKUP_IMPORT]
        : [mergeEntries.FOLDER_IMPORT, mergeEntries.BACKUP_IMPORT])
    );

    storageSourceMenuItems.push(
      ...(isStorageSourceAvailable(StorageKey.GDRIVE, $gDriveStorageSource$, window)
        ? [
            {
              label: 'GDrive',
              key: StorageKey.GDRIVE,
              requiresConnectivity: true
            }
          ]
        : []),
      ...(isStorageSourceAvailable(StorageKey.ONEDRIVE, $oneDriveStorageSource$, window)
        ? [
            {
              label: 'OneDrive',
              key: StorageKey.ONEDRIVE,
              requiresConnectivity: true
            }
          ]
        : []),
      ...(isStorageSourceAvailable(StorageKey.FS, $fsStorageSource$, window)
        ? [
            {
              label: 'Filesystem',
              key: StorageKey.FS,
              requiresConnectivity: false
            }
          ]
        : [])
    );
  }

  $: sortMenuItems = [
    ...($storageSource$ === StorageKey.BROWSER ? [{ property: 'id', label: 'Added (id)' }] : []),
    { property: 'title', label: 'Title' },
    { property: 'characters', label: 'Characters' },
    { property: 'lastBookModified', label: 'Last Update' },
    { property: 'lastBookOpen', label: 'Last Read' },
    { property: 'progress', label: 'Progress' },
    { property: 'lastBookmarkModified', label: 'Bookmarked' }
  ];

  function triggerInput(event: CustomEvent<string>) {
    switch (event.detail) {
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

  function changeSortOptions(clickedProperty: string, newDirection: SortDirection) {
    const { property, direction } = $booklistSortOptions$[$storageSource$];

    if (property !== clickedProperty || direction !== newDirection) {
      booklistSortOptions$.next({
        ...$booklistSortOptions$,
        ...{
          [$storageSource$]: {
            property: clickedProperty as Exclude<
              keyof BookCardProps,
              'imagePath' | 'isPlaceholder'
            >,
            direction: newDirection
          }
        }
      });
    }

    sortOptionsElm.toggleOpen();
  }
</script>

<input
  hidden
  multiple
  type="file"
  accept="application/epub+zip,.epub,.htmlz,plain/text,.txt"
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
{#if !replicationToProgress}
  <TopBar bordered={true} density="compact">
    <div slot="start" class="flex items-center gap-1.5">
      {#if selectedCount === 0}
        <Tooltip text={selectMode ? 'Disable Book Selection' : 'Enable Book Selection'}>
          <IconButton
            label={selectMode ? 'Disable Book Selection' : 'Enable Book Selection'}
            size="md"
            variant={selectMode ? 'secondary' : 'ghost'}
            active={selectMode}
            on:click={() => (selectMode = hasBooks && !selectMode)}
          >
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 fill-current"
            >
              <path
                d="M20,4v12H8V4H20 M20,2H8C6.9,2,6,2.9,6,4v12c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2L20,2z M12.47,14 L9,10.5l1.4-1.41l2.07,2.08L17.6,6L19,7.41L12.47,14z M4,6H2v14c0,1.1,0.9,2,2,2h14v-2H4V6z"
              />
            </svg>
          </IconButton>
        </Tooltip>
      {:else}
        <Tooltip text="Disable Book Selection">
          <IconButton
            label="Disable Book Selection"
            size="md"
            variant="ghost"
            on:click={() => (selectMode = !selectMode)}
          >
            <Fa icon={faTimes} class="text-base" />
          </IconButton>
        </Tooltip>
        <span
          class="inline-flex items-center justify-center rounded-full bg-[var(--astryx-color-primary-subtle,rgba(99,102,241,0.15))] px-2 py-0.5 text-xs font-semibold text-[var(--astryx-color-primary,#6366f1)]"
        >
          {selectedCount}
        </span>
      {/if}
    </div>

    <div class="flex items-center justify-center">
      {#if !selectMode}
        {#if hasBookOpened}
          <Tooltip text="Back to Book">
            <IconButton
              label="Back to Book"
              size="md"
              variant="ghost"
              on:click={() => dispatch('backToBookClick')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                class="h-5 w-5 fill-current"
              >
                <path
                  d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5zm-3.5-8c.88 0 1.73.09 2.5.26V9.24c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99zM13 12.49v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26V11.9c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.3-4.5.83zm4.5 1.84c-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26v-1.52c-.79-.16-1.64-.24-2.5-.24z"
                />
              </svg>
            </IconButton>
          </Tooltip>
        {/if}
      {:else}
        <Tooltip text="Select all Books">
          <IconButton
            label="Select all Books"
            size="md"
            variant="ghost"
            on:click={() => dispatch('selectAllClick')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              class="h-5 w-5 fill-current"
            >
              <path
                d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"
              />
            </svg>
          </IconButton>
        </Tooltip>
      {/if}
    </div>

    <div slot="end" class="flex items-center gap-1">
      {#if !selectMode}
        <MergedHeaderIcon
          items={importMenuItems}
          mergeTo={mergeEntries.FILE_IMPORT}
          on:action={triggerInput}
        />

        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={4}
          bind:this={storageSourceElm}
        >
          <div
            slot="icon"
            class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--astryx-radius-md,6px)] text-[var(--astryx-color-fg-muted)] transition-colors hover:bg-[var(--astryx-color-surface-hover)] hover:text-[var(--astryx-color-fg-primary)]"
            title="Select Storage Source"
          >
            {#key $storageIcon$}
              <svg
                class="h-5 w-5 fill-current"
                xmlns="http://www.w3.org/2000/svg"
                viewBox={$storageIcon$.viewBox}
              >
                <path class="fill-current" d={$storageIcon$.d} />
              </svg>
            {/key}
          </div>
          <div
            class="min-w-[7.5rem] rounded-lg border border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-surface)] py-1 shadow-lg"
            slot="content"
          >
            {#each storageSourceMenuItems as sourceMenuItem (sourceMenuItem.key)}
              <div
                tabindex="0"
                role="button"
                class="cursor-pointer px-4 py-2 text-left text-sm text-[var(--astryx-color-fg-primary)] transition-colors hover:bg-[var(--astryx-color-surface-hover)]"
                class:cursor-not-allowed={sourceMenuItem.requiresConnectivity && !$isOnline$}
                class:opacity-50={sourceMenuItem.requiresConnectivity && !$isOnline$}
                on:click={async () => {
                  if (sourceMenuItem.requiresConnectivity && !$isOnline$) {
                    return;
                  }

                  if (sourceMenuItem.key !== $storageSource$) {
                    if (!$cacheStorageData$) {
                      getStorageHandler(window, sourceMenuItem.key).clearData();
                    }

                    storageSource$.next(sourceMenuItem.key);
                  }

                  storageSourceElm.toggleOpen();
                }}
                on:keyup={dummyFn}
              >
                {sourceMenuItem.label}
              </div>
            {/each}
          </div>
        </Popover>

        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={4}
          bind:this={sortOptionsElm}
        >
          <div
            slot="icon"
            class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--astryx-radius-md,6px)] text-[var(--astryx-color-fg-muted)] transition-colors hover:bg-[var(--astryx-color-surface-hover)] hover:text-[var(--astryx-color-fg-primary)]"
            title="Select Sort Options"
          >
            {#if $booklistSortOptions$[$storageSource$].direction === SortDirection.ASC}
              <Fa icon={faArrowDownShortWide} class="text-base" />
            {:else}
              <Fa icon={faArrowDownWideShort} class="text-base" />
            {/if}
          </div>
          <div
            class="min-w-[12rem] rounded-lg border border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-surface)] py-1 shadow-lg"
            slot="content"
          >
            {#each sortMenuItems as sortMenuItem (sortMenuItem.property)}
              {@const isCurrentSort =
                $booklistSortOptions$[$storageSource$].property === sortMenuItem.property}
              {@const isCurrentSortAsc =
                isCurrentSort &&
                $booklistSortOptions$[$storageSource$].direction === SortDirection.ASC}
              <div
                class="grid grid-cols-[auto_1fr_auto] items-center text-sm transition-colors hover:bg-[var(--astryx-color-surface-hover)]"
                class:bg-[var(--astryx-color-surface-active)]={isCurrentSort}
              >
                <div
                  tabindex="0"
                  role="button"
                  class="cursor-pointer p-2 transition-colors"
                  class:text-[var(--astryx-color-primary)]={isCurrentSortAsc}
                  class:text-[var(--astryx-color-fg-muted)]={!isCurrentSortAsc}
                  class:hover:text-[var(--astryx-color-primary)]={!isCurrentSortAsc}
                  title="Sort Ascending"
                  on:click={() => {
                    changeSortOptions(sortMenuItem.property, SortDirection.ASC);
                  }}
                  on:keyup={dummyFn}
                >
                  <Fa icon={faSortUp} class="px-2" />
                </div>
                <div class="truncate px-1 py-2 font-medium text-[var(--astryx-color-fg-primary)]">
                  {sortMenuItem.label}
                </div>
                <div
                  tabindex="0"
                  role="button"
                  class="cursor-pointer p-2 transition-colors"
                  class:text-[var(--astryx-color-primary)]={isCurrentSort && !isCurrentSortAsc}
                  class:text-[var(--astryx-color-fg-muted)]={!isCurrentSort || isCurrentSortAsc}
                  class:hover:text-[var(--astryx-color-primary)]={!isCurrentSort ||
                    isCurrentSortAsc}
                  title="Sort Descending"
                  on:click={() => {
                    changeSortOptions(sortMenuItem.property, SortDirection.DESC);
                  }}
                  on:keyup={dummyFn}
                >
                  <Fa icon={faSortDown} class="mt-0.5 px-2" />
                </div>
              </div>
            {/each}
          </div>
        </Popover>

        <MergedHeaderIcon
          items={isOldUrl
            ? [
                mergeEntries.MANAGE,
                mergeEntries.DOMAIN_HINT,
                mergeEntries.BUG_REPORT,
                mergeEntries.SETTINGS
              ]
            : [
                mergeEntries.MANAGE,
                mergeEntries.UI_SHOWCASE,
                mergeEntries.STATISTICS,
                mergeEntries.SETTINGS,
                mergeEntries.BUG_REPORT
              ]}
          on:action={({ detail }) => {
            if (detail === mergeEntries.BUG_REPORT.label) {
              dispatch('bugReportClick');
            }
            if (detail === mergeEntries.DOMAIN_HINT.label) {
              dispatch('domainHintClick');
            }
          }}
        />

        {#if showLoadCount}
          <button
            style:color={!!$fileCountData$ ? 'red' : null}
            on:click={() => countImportElm.click()}>C</button
          >
        {/if}
      {:else}
        <Tooltip text="Open Export Menu">
          <IconButton
            label="Open Export Menu"
            size="md"
            variant="ghost"
            on:click={() => dispatch('replicateData')}
          >
            <Fa icon={faCloudArrowUp} class="text-base" />
          </IconButton>
        </Tooltip>

        {#if $storageSource$ === StorageKey.BROWSER}
          <Tooltip text="Go to Statistics">
            <IconButton
              label="Go to Statistics"
              size="md"
              variant="ghost"
              on:click={() => dispatch('selectionToStatistics')}
            >
              <Fa icon={faChartLine} class="text-base" />
            </IconButton>
          </Tooltip>

          <Tooltip text="Delete Statistics for selected Books">
            <IconButton
              label="Delete Statistics for selected Books"
              size="md"
              variant="ghost"
              on:click={() => dispatch('deleteStatistics')}
            >
              <Fa icon={faCalendarXmark} class="text-base" />
            </IconButton>
          </Tooltip>
        {/if}

        <Tooltip text="Delete selected Books">
          <IconButton
            label="Delete selected Books"
            size="md"
            variant="ghost"
            class="text-[var(--astryx-color-danger,#ef4444)] hover:text-[var(--astryx-color-danger,#ef4444)]"
            on:click={() => dispatch('removeClick')}
          >
            <Fa icon={faTrash} class="text-base" />
          </IconButton>
        </Tooltip>
      {/if}
    </div>
  </TopBar>
{:else}
  <TopBar bordered={true} density="compact">
    <div
      title="Cancel Operation"
      class="mx-auto flex h-full w-full max-w-2xl items-center justify-between px-2"
    >
      <Popover contentText={cancelTooltip} contentStyles={'padding: 0.75rem'} eventType="pointer">
        <div
          tabindex="0"
          role="button"
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--astryx-radius-md,6px)] text-[var(--astryx-color-danger,#ef4444)] hover:bg-[var(--astryx-color-surface-hover)]"
          on:click={() => dispatch('cancelReplication')}
          on:keyup={dummyFn}
        >
          <Fa icon={faCircleXmark} class="text-lg" />
        </div>
      </Popover>
      <div class="mx-4 flex-1">
        <progress
          class="h-2 w-full overflow-hidden rounded-full bg-[var(--astryx-color-surface-hover)] accent-[var(--astryx-color-primary)]"
          value={replicationProgress}
          max={replicationToProgress}
        ></progress>
      </div>
      <div class="min-w-fit text-sm font-medium text-[var(--astryx-color-fg-muted)]">
        {replicationProgressRemaining}
      </div>
    </div>
  </TopBar>
{/if}
