<script lang="ts">
  import { browser } from '$app/environment';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    baseHeaderClasses,
    baseIconClasses,
    nTranslateXHeaderFa,
    pHeaderFa,
    pxScreen,
    translateXHeaderFa
  } from '$lib/css-classes';
  import { SortDirection } from '$lib/data/sort-types';
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
  import { quintOut } from 'svelte/easing';
  import { scale } from 'svelte/transition';

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

  const nTranslateXHeaderMat = '-translate-x-3 xl:-translate-x-2.5';

  const inAnimationParams = {
    delay: 150,
    duration: 150,
    easing: quintOut
  };

  const outAnimationParams = {
    duration: 150,
    easing: quintOut
  };

  const importMenuItems = [mergeEntries.FILE_IMPORT];
  const storageSourceMenuItems = [
    { label: 'Browser', key: StorageKey.BROWSER, requiresConnectivity: false }
  ];

  let fileImportElm: HTMLElement;
  let folderImportElm: HTMLElement;
  let backupImportElm: HTMLElement;
  let storageSourceElm: Popover;
  let sortOptionsElm: Popover;
  let isOldUrl = false;

  $: if (browser) {
    isOldUrl = isOnOldUrl(window);

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
<div class={baseHeaderClasses}>
  {#if !replicationToProgress}
    <div class="flex h-full justify-between {pxScreen}">
      {#if selectedCount === 0}
        <div
          class="transform-gpu {nTranslateXHeaderMat}"
          in:scale={inAnimationParams}
          out:scale={outAnimationParams}
        >
          <svg
            tabindex="0"
            role="button"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            class:opacity-100={selectMode}
            class:opacity-60={!selectMode}
            class={baseIconClasses}
            on:click={() => (selectMode = hasBooks && !selectMode)}
            on:keyup={dummyFn}
          >
            <path
              class="fill-current"
              d="M20,4v12H8V4H20 M20,2H8C6.9,2,6,2.9,6,4v12c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2L20,2z M12.47,14 L9,10.5l1.4-1.41l2.07,2.08L17.6,6L19,7.41L12.47,14z M4,6H2v14c0,1.1,0.9,2,2,2h14v-2H4V6z"
            />
          </svg>
        </div>
      {:else}
        <div
          class="flex h-full transform-gpu items-center {nTranslateXHeaderFa} text-xl font-medium"
        >
          <div
            tabindex="0"
            role="button"
            class="flex h-full items-center text-2xl xl:text-xl {pHeaderFa} cursor-pointer"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
            on:click={() => (selectMode = !selectMode)}
            on:keyup={dummyFn}
          >
            <Fa icon={faTimes} />
          </div>
          <span
            class="translate-x-2 transform-gpu"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}>{selectedCount}</span
          >
        </div>
      {/if}

      <div class="absolute left-1/2 h-full -translate-x-1/2 transform-gpu">
        {#if !selectMode}
          {#if hasBookOpened}
            <svg
              tabindex="0"
              role="button"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              class={baseIconClasses}
              in:scale={inAnimationParams}
              out:scale={outAnimationParams}
              on:click={() => dispatch('backToBookClick')}
              on:keyup={dummyFn}
            >
              <path
                class="fill-current"
                d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5zm-3.5-8c.88 0 1.73.09 2.5.26V9.24c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99zM13 12.49v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26V11.9c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.3-4.5.83zm4.5 1.84c-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26v-1.52c-.79-.16-1.64-.24-2.5-.24z"
              />
            </svg>
          {/if}
        {:else}
          <svg
            tabindex="0"
            role="button"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class={baseIconClasses}
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
            on:click={() => dispatch('selectAllClick')}
            on:keyup={dummyFn}
          >
            <path
              class="fill-current"
              d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"
            />
          </svg>
        {/if}
      </div>

      <div class="flex transform-gpu {translateXHeaderFa}">
        {#if !selectMode}
          <div
            class="relative transform-gpu"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
          >
            <MergedHeaderIcon
              items={importMenuItems}
              mergeTo={mergeEntries.FILE_IMPORT}
              on:action={triggerInput}
            />
          </div>
          <div
            class="relative transform-gpu"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
          >
            <Popover
              placement="bottom"
              fallbackPlacements={['bottom-end', 'bottom-start']}
              yOffset={0}
              bind:this={storageSourceElm}
            >
              <div slot="icon">
                {#key $storageIcon$}
                  <svg
                    class={baseIconClasses}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={$storageIcon$.viewBox}
                  >
                    <path class="fill-current" d={$storageIcon$.d} />
                  </svg>
                {/key}
              </div>
              <div class="w-28 bg-gray-700" slot="content">
                {#each storageSourceMenuItems as sourceMenuItem (sourceMenuItem.key)}
                  <div
                    tabindex="0"
                    role="button"
                    class="cursor-pointer px-4 py-2 text-sm hover:bg-white hover:text-gray-700"
                    class:hover:bg-white={!sourceMenuItem.requiresConnectivity || $isOnline$}
                    class:hover:text-gray-700={!sourceMenuItem.requiresConnectivity || $isOnline$}
                    class:cursor-not-allowed={sourceMenuItem.requiresConnectivity && !$isOnline$}
                    class:text-gray-500={sourceMenuItem.requiresConnectivity && !$isOnline$}
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
          </div>
          <div
            class="relative transform-gpu"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
          >
            <Popover
              placement="bottom"
              fallbackPlacements={['bottom-end', 'bottom-start']}
              yOffset={0}
              bind:this={sortOptionsElm}
            >
              <div slot="icon" class={baseIconClasses}>
                {#if $booklistSortOptions$[$storageSource$].direction === SortDirection.ASC}
                  <Fa icon={faArrowDownShortWide} />
                {:else}
                  <Fa icon={faArrowDownWideShort} />
                {/if}
              </div>
              <div class="w-44 bg-gray-700" slot="content">
                {#each sortMenuItems as sortMenuItem (sortMenuItem.property)}
                  {@const isCurrentSort =
                    $booklistSortOptions$[$storageSource$].property === sortMenuItem.property}
                  {@const isCurrentSortAsc =
                    isCurrentSort &&
                    $booklistSortOptions$[$storageSource$].direction === SortDirection.ASC}
                  <div
                    class="grid cursor-default grid-cols-[auto_auto_auto] text-sm hover:bg-white hover:text-gray-700"
                    class:bg-white={isCurrentSort}
                    class:text-gray-700={isCurrentSort}
                    class:hover:opacity-70={isCurrentSort}
                  >
                    <div
                      tabindex="0"
                      role="button"
                      class="self-center justify-self-start"
                      class:text-red-500={isCurrentSortAsc}
                      class:hover:text-gray-700={isCurrentSortAsc}
                      class:hover:text-red-500={!isCurrentSortAsc}
                      on:click={() => {
                        changeSortOptions(sortMenuItem.property, SortDirection.ASC);
                      }}
                      on:keyup={() => {}}
                    >
                      <Fa icon={faSortUp} class="px-4" />
                    </div>
                    <div class="py-2">
                      {sortMenuItem.label}
                    </div>
                    <div
                      tabindex="0"
                      role="button"
                      class="justify-self-end hover:text-red-500"
                      class:text-red-500={isCurrentSort && !isCurrentSortAsc}
                      class:hover:text-gray-700={isCurrentSort && !isCurrentSortAsc}
                      class:hover:text-red-500={!isCurrentSort || isCurrentSortAsc}
                      on:click={() => {
                        changeSortOptions(sortMenuItem.property, SortDirection.DESC);
                      }}
                      on:keyup={() => {}}
                    >
                      <Fa icon={faSortDown} class="mt-1 px-4" />
                    </div>
                  </div>
                {/each}
              </div>
            </Popover>
          </div>
          <div
            class="relative transform-gpu"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
          >
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
          </div>
        {/if}

        {#if selectedCount > 0}
          <div
            tabindex="0"
            role="button"
            class="transform-gpu {baseIconClasses}"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
            on:click={() => dispatch('replicateData')}
            on:keyup={dummyFn}
          >
            <Fa icon={faCloudArrowUp} />
          </div>
          {#if $storageSource$ === StorageKey.BROWSER}
            <div
              tabindex="0"
              role="button"
              class="transform-gpu {baseIconClasses}"
              in:scale={inAnimationParams}
              out:scale={outAnimationParams}
              on:click={() => dispatch('selectionToStatistics')}
              on:keyup={dummyFn}
            >
              <Fa icon={faChartLine} />
            </div>
            <div
              tabindex="0"
              role="button"
              class="transform-gpu {baseIconClasses}"
              in:scale={inAnimationParams}
              out:scale={outAnimationParams}
              on:click={() => dispatch('deleteStatistics')}
              on:keyup={dummyFn}
            >
              <Fa icon={faCalendarXmark} />
            </div>
          {/if}
          <div
            tabindex="0"
            role="button"
            class="transform-gpu {baseIconClasses}"
            in:scale={inAnimationParams}
            out:scale={outAnimationParams}
            on:click={() => dispatch('removeClick')}
            on:keyup={dummyFn}
          >
            <Fa icon={faTrash} />
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div
      class="mx-auto flex h-full transform-gpu items-center justify-center px-4 md:px-8 lg:max-w-4xl xl:max-w-none 2xl:max-w-6xl"
      in:scale={inAnimationParams}
      out:scale={outAnimationParams}
    >
      <Popover contentText={cancelTooltip} contentStyles={'padding: 0.75rem'} eventType="pointer">
        <div
          tabindex="0"
          role="button"
          on:click={() => dispatch('cancelReplication')}
          on:keyup={dummyFn}
        >
          <Fa icon={faCircleXmark} class="cursor-pointer" />
        </div>
      </Popover>
      <progress class="mx-4 w-full" value={replicationProgress} max={replicationToProgress} />
      <div class="ml-4 min-w-fit">{replicationProgressRemaining}</div>
    </div>
  {/if}
</div>
