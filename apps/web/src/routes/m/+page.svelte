<script lang="ts">
  /**
   * Manga reader (CBZ/ZIP, not part of upstream), modeled on Mihon/Tachiyomi: one page at a time
   * (right to left or left to right) or a vertical strip; tap the middle for the menu.
   * Book-only extras (highlights, recap, listen, search, statistics) are left out.
   */
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Fa from 'svelte-fa';
  import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import {
    autoReplication$,
    cacheStorageData$,
    database,
    readingGoalsMergeMode$,
    replicationSaveBehavior$,
    statisticsMergeMode$,
    syncTarget$
  } from '$lib/data/store';
  import { pagePath } from '$lib/data/env';
  import { logger } from '$lib/data/logger';
  import {
    mangaBookmark,
    mangaPages,
    mangaReadingMode$,
    tapDirection,
    type MangaReadingMode
  } from '$lib/data/manga';
  import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import type { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
  import type { BrowserStorageHandler } from '$lib/data/storage/handler/browser-handler';
  import {
    StorageDataType,
    StorageKey,
    StorageSourceDefault
  } from '$lib/data/storage/storage-types';
  import { AutoReplicationType } from '$lib/functions/replication/replication-options';
  import { replicateData } from '$lib/functions/replication/replicator';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  const modes: { value: MangaReadingMode; label: string }[] = [
    { value: 'rtl', label: 'Right to left' },
    { value: 'ltr', label: 'Left to right' },
    { value: 'vertical', label: 'Vertical' }
  ];
  const defaultSources: Record<string, StorageKey> = {
    [StorageSourceDefault.CALIBRE_DEFAULT]: StorageKey.CALIBRE,
    [StorageSourceDefault.GDRIVE_DEFAULT]: StorageKey.GDRIVE,
    [StorageSourceDefault.ONEDRIVE_DEFAULT]: StorageKey.ONEDRIVE
  };

  let book: BooksDbBookData | undefined;
  let urls: string[] = [];
  let pageIndex = 0;
  let savedIndex = -1;
  /** Set once the saved position is known, so nothing is saved over it before. */
  let ready = false;
  let showMenu = false;
  let loaded = new Set<number>();
  let strip: HTMLElement | undefined;
  let local: BrowserStorageHandler;
  let external: BaseStorageHandler | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerStart: { x: number; y: number } | undefined;

  $: mode = $mangaReadingMode$;
  $: pageCount = urls.length;
  $: if (ready && pageIndex !== savedIndex) scheduleSave();

  function handler(type: StorageKey, name?: string) {
    return getStorageHandler(
      window,
      type,
      name,
      true,
      $cacheStorageData$,
      $replicationSaveBehavior$,
      $statisticsMergeMode$,
      $readingGoalsMergeMode$
    );
  }

  /** Where this book's progress syncs, as in the book reader (Calibre always syncs). */
  async function externalHandler(data: BooksDbBookData) {
    const name =
      data.storageSource || ($autoReplication$ !== AutoReplicationType.Off ? $syncTarget$ : '');

    if (!name) return undefined;

    const type =
      defaultSources[name] ?? (await (await database.db).get('storageSource', name))?.type;

    return type ? handler(type, name) : undefined;
  }

  function context() {
    return { id: book!.id, title: book!.title, imagePath: book!.coverImage };
  }

  async function load(id: number) {
    local = handler(StorageKey.BROWSER) as BrowserStorageHandler;
    local.startContext({ id, title: '' });

    const data = await local.getBook();

    if (!data) {
      goto(`${pagePath}/manage`);
      return;
    }

    book = data;
    local.startContext(context());
    urls = mangaPages(data).map((name) => URL.createObjectURL(data.blobs[name]));
    data.lastBookOpen = Date.now();
    await local.updateLastRead(data);

    try {
      external = await externalHandler(data);

      if (external) {
        external.startContext(context());

        if (
          external.storageType === StorageKey.CALIBRE ||
          $autoReplication$ === AutoReplicationType.Down ||
          $autoReplication$ === AutoReplicationType.All
        ) {
          const error = await replicateData(external, local, false, [context()], [
            StorageDataType.PROGRESS
          ]);

          if (error) throw new Error(error);
        }

        await external.updateLastRead(data);
      }
    } catch (error: any) {
      // Reading works offline from the browser copy; progress syncs on the next save.
      logger.warn(`Manga sync failed: ${error.message}`);
    }

    const bookmark = await database.getBookmark(data.id);

    savedIndex = Math.min(bookmark?.exploredCharCount || 0, Math.max(pageCount - 1, 0));
    goToPage(savedIndex);
    ready = true;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1000);
  }

  async function save() {
    clearTimeout(saveTimer);

    if (!ready || pageIndex === savedIndex) return;

    savedIndex = pageIndex;
    await database.putBookmark(mangaBookmark(book!.id, pageIndex, pageCount));

    const upSync =
      external &&
      (external.storageType === StorageKey.CALIBRE ||
        $autoReplication$ === AutoReplicationType.Up ||
        $autoReplication$ === AutoReplicationType.All);

    if (upSync) {
      const error = await replicateData(local, external!, false, [context()], [
        StorageDataType.PROGRESS
      ]).catch((err: any) => err.message);

      if (error) logger.warn(`Manga progress sync failed: ${error}`);
    }
  }

  function goToPage(index: number) {
    pageIndex = Math.max(0, Math.min(pageCount - 1, index));

    if (mode === 'vertical') {
      strip?.children[pageIndex]?.scrollIntoView();
    }
  }

  function onStripScroll() {
    if (!strip) return;

    const middle = strip.getBoundingClientRect().top + strip.clientHeight / 2;
    const pages = [...strip.children];
    const index = pages.findIndex((img) => img.getBoundingClientRect().bottom > middle);

    pageIndex = index === -1 ? pages.length - 1 : index;
  }

  function onPointerDown(event: PointerEvent) {
    pointerStart = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    if (!pointerStart) return;

    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;

    pointerStart = undefined;

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const turn = mode === 'vertical' ? 0 : tapDirection(event.clientX, window.innerWidth, mode);

      if (turn) {
        goToPage(pageIndex + turn);
        showMenu = false;
      } else {
        showMenu = !showMenu;
      }
    } else if (mode !== 'vertical' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      // Swiping drags the page along: right to left means forward unless reading right to left.
      goToPage(pageIndex + ((dx < 0) === (mode === 'ltr') ? 1 : -1));
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;

    const forward = mode === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = mode === 'rtl' ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === 'Escape') {
      showMenu = !showMenu;
    } else if (mode === 'vertical') {
      return;
    } else if (event.key === forward || event.key === ' ' || event.key === 'PageDown') {
      goToPage(pageIndex + 1);
    } else if (event.key === back || event.key === 'PageUp') {
      goToPage(pageIndex - 1);
    } else {
      return;
    }

    event.preventDefault();
  }

  function setMode(value: MangaReadingMode) {
    mangaReadingMode$.next(value);
    // The strip is rendered after the mode changes; keep the page.
    setTimeout(() => goToPage(pageIndex));
  }

  async function leave() {
    await save().catch((error) => logger.warn(error.message));
    await database.deleteLastItem();
    goto(`${pagePath}/manage`);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') save();
  }

  onMount(() => {
    load(Number($page.url.searchParams.get('id'))).catch((error) =>
      logger.error(`Error loading manga: ${error.message}`)
    );
  });

  onDestroy(() => {
    save();
    urls.forEach((url) => URL.revokeObjectURL(url));
  });
</script>

<svelte:head>
  <title>{formatPageTitle(book?.title ?? '')}</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} />
<svelte:document on:visibilitychange={onVisibilityChange} />

<div
  class="fixed inset-0 select-none bg-black"
  style:touch-action={mode === 'vertical' ? 'pan-y pinch-zoom' : 'pinch-zoom'}
  on:pointerdown={onPointerDown}
  on:pointerup={onPointerUp}
>
  {#if mode === 'vertical'}
    <div class="h-full overflow-y-auto" bind:this={strip} on:scroll={onStripScroll}>
      {#each urls as url, index}
        <img
          src={url}
          alt="Page {index + 1}"
          loading="lazy"
          draggable="false"
          class="mx-auto block w-full max-w-3xl"
          class:min-h-[60vh]={!loaded.has(index)}
          on:load={() => (loaded = new Set(loaded).add(index))}
        />
      {/each}
    </div>
  {:else if urls[pageIndex]}
    <img
      src={urls[pageIndex]}
      alt="Page {pageIndex + 1}"
      draggable="false"
      class="h-full w-full object-contain"
    />
    <!-- Decode the neighbours ahead of time so turning is instant. -->
    {#each [pageIndex - 1, pageIndex + 1] as index}
      {#if urls[index]}
        <img src={urls[index]} alt="" class="hidden" />
      {/if}
    {/each}
  {/if}
</div>

{#if showMenu}
  <div
    class="reader-panel fixed inset-x-0 top-0 flex items-center gap-3 px-3 py-2"
    transition:fly={{ y: -40, duration: 150 }}
  >
    <button class="p-2" title="Back to the library" aria-label="Back" on:click={leave}>
      <Fa icon={faArrowLeft} />
    </button>
    <div class="min-w-0 flex-1 truncate">{book?.title ?? ''}</div>
  </div>

  <div
    class="reader-panel fixed inset-x-0 bottom-0 flex flex-col gap-3 px-4 py-3"
    transition:fly={{ y: 40, duration: 150 }}
  >
    <div class="flex items-center gap-3" dir={mode === 'rtl' ? 'rtl' : 'ltr'}>
      <span class="w-10 text-center tabular-nums">{pageIndex + 1}</span>
      <input
        class="flex-1"
        type="range"
        min="0"
        max={Math.max(pageCount - 1, 0)}
        value={pageIndex}
        aria-label="Page"
        on:input={(event) => goToPage(Number(event.currentTarget.value))}
      />
      <span class="w-10 text-center tabular-nums">{pageCount}</span>
    </div>
    <div class="flex justify-center gap-2" role="radiogroup" aria-label="Reading mode">
      {#each modes as option}
        <button
          class="rounded px-3 py-1 text-sm"
          class:font-bold={mode === option.value}
          class:underline={mode === option.value}
          role="radio"
          aria-checked={mode === option.value}
          on:click={() => setMode(option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>
{/if}
