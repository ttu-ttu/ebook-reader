<script lang="ts">
  /**
   * Manga reader (CBZ/ZIP, not part of upstream), modeled on Mihon/Tachiyomi: one page or a
   * two-page spread at a time (right to left or left to right) or a vertical strip; tap the
   * middle for the menu. Paged modes handle their own gestures: swipes drag the page along,
   * pinch, double tap and Ctrl+wheel zoom, and a zoomed page pans.
   * Book-only extras (highlights, recap, listen, search, statistics) are left out.
   */
  import { onDestroy, onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Fa from 'svelte-fa';
  import { faArrowLeft, faExpand, faGear } from '@fortawesome/free-solid-svg-icons';
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import {
    optionsForToggle,
    type ToggleOption
  } from '$lib/components/button-toggle-group/toggle-option';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
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
  import { fullscreenManager } from '$lib/data/fullscreen-manager';
  import { logger } from '$lib/data/logger';
  import {
    borderColor,
    clampPan,
    fitSize,
    mangaBackground$,
    mangaBookmark,
    mangaDoubleTapZoom$,
    mangaDualPage$,
    mangaKeepScreenOn$,
    mangaPageNumber$,
    mangaPages,
    mangaReadingMode$,
    mangaScale$,
    pageSpreads,
    tapDirection,
    type MangaBackground,
    type MangaDualPage,
    type MangaReadingMode,
    type MangaScale,
    type PageSize
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

  const modes: ToggleOption<MangaReadingMode>[] = [
    { id: 'rtl', text: 'Right to left' },
    { id: 'ltr', text: 'Left to right' },
    { id: 'vertical', text: 'Vertical' }
  ];
  const scales: ToggleOption<MangaScale>[] = [
    { id: 'screen', text: 'Screen' },
    { id: 'width', text: 'Width' },
    { id: 'height', text: 'Height' },
    { id: 'original', text: 'Original' },
    { id: 'smart', text: 'Smart' }
  ];
  const dualPages: ToggleOption<MangaDualPage>[] = [
    { id: 'auto', text: 'Auto' },
    { id: 'on', text: 'On' },
    { id: 'off', text: 'Off' }
  ];
  const backgrounds: ToggleOption<MangaBackground>[] = [
    { id: 'black', text: 'Black' },
    { id: 'gray', text: 'Gray' },
    { id: 'white', text: 'White' },
    { id: 'auto', text: 'Auto' }
  ];
  // The reader's backdrop is part of the page, not the theme.
  const backgroundColors = { black: '#000', gray: '#262626', white: '#fff' };
  const defaultSources: Record<string, StorageKey> = {
    [StorageSourceDefault.CALIBRE_DEFAULT]: StorageKey.CALIBRE,
    [StorageSourceDefault.GDRIVE_DEFAULT]: StorageKey.GDRIVE,
    [StorageSourceDefault.ONEDRIVE_DEFAULT]: StorageKey.ONEDRIVE
  };
  /** Until a page's size is known it is laid out as a typical portrait page. */
  const unknownSize = { width: 7, height: 10 };
  const turnMs = 200;
  const maxZoom = 5;
  const wakeLockSupported = browser && 'wakeLock' in navigator;

  let book: BooksDbBookData | undefined;
  let urls: string[] = [];
  let sizes: (PageSize | undefined)[] = [];
  let pageIndex = 0;
  let savedIndex = -1;
  /** Set once the saved position is known, so nothing is saved over it before. */
  let ready = false;
  let showMenu = false;
  let showSettings = false;
  let shift = false;
  let loaded = new Set<number>();
  let strip: HTMLElement | undefined;
  let local: BrowserStorageHandler;
  let external: BaseStorageHandler | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerStart: { x: number; y: number } | undefined;
  let viewWidth = 0;
  let viewHeight = 0;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  /** Horizontal offset of the page track while a page is dragged or turning. */
  let dragX = 0;
  let animating = false;
  let autoBackground = '#000';
  let wakeLock: WakeLockSentinel | undefined;

  $: mode = $mangaReadingMode$;
  $: pageCount = urls.length;
  $: view = { width: viewWidth, height: viewHeight };
  $: dual = $mangaDualPage$ === 'on' || ($mangaDualPage$ === 'auto' && viewWidth > viewHeight);
  $: groups = pageSpreads(sizes, dual, shift);
  $: groupIndex = Math.max(
    0,
    groups.findIndex((group) => group.includes(pageIndex))
  );
  /** The page a bookmark keeps: the last one shown, so a final spread counts as finished. */
  $: shownPage = mode === 'vertical' ? pageIndex : (groups[groupIndex]?.at(-1) ?? pageIndex);
  $: if (ready && shownPage !== savedIndex) scheduleSave();
  // Next is to the left in right-to-left manga.
  $: sign = mode === 'rtl' ? -1 : 1;
  $: base = groupSize(groupIndex, groups, sizes, $mangaScale$, view);
  $: content = { width: base.width * zoom, height: base.height * zoom };
  $: overflows = content.width > viewWidth + 1 || content.height > viewHeight + 1;
  $: resetView(groupIndex, base);
  $: slots = [-1, 0, 1]
    .map((offset) => groupIndex + offset)
    .filter((index) => mode !== 'vertical' && groups[index]);
  $: preload(groups, groupIndex);
  // Reactive so the template follows every value it reads.
  $: slotStyle = (index: number) => {
    const own = index === groupIndex;
    const size = own ? content : groupSize(index, groups, sizes, $mangaScale$, view);
    const at = own ? pan : startPan(size);
    const offset = (index - groupIndex) * viewWidth * sign + dragX;

    return (
      `transform: translate(${offset + at.x}px, ${at.y}px);` +
      `width: ${size.width}px; height: ${size.height}px;` +
      (animating ? `transition: transform ${turnMs}ms ease-out;` : '')
    );
  };
  $: background =
    $mangaBackground$ === 'auto' ? autoBackground : backgroundColors[$mangaBackground$];
  $: if ($mangaBackground$ === 'auto') sampleBackground(urls[groups[groupIndex]?.[0] ?? pageIndex]);
  $: scrollStripOnModeChange(mode);
  $: if (browser) updateWakeLock($mangaKeepScreenOn$);
  $: shownPages = mode === 'vertical' ? [pageIndex] : (groups[groupIndex] ?? [pageIndex]);

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

  /** Reads every page's size (for spreads and fitting) without keeping the images. */
  function measurePages() {
    const found: (PageSize | undefined)[] = new Array(urls.length);
    let queued = false;

    urls.forEach((url, index) => {
      const img = new Image();

      img.onload = () => {
        found[index] = { width: img.naturalWidth, height: img.naturalHeight };
        img.src = '';

        if (queued) return;

        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          sizes = [...found];
        });
      };
      img.src = url;
    });
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
    sizes = new Array(urls.length);
    measurePages();
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
          const error = await replicateData(
            external,
            local,
            false,
            [context()],
            [StorageDataType.PROGRESS]
          );

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

    if (!ready || shownPage === savedIndex) return;

    savedIndex = shownPage;
    await database.putBookmark(mangaBookmark(book!.id, shownPage, pageCount));

    const upSync =
      external &&
      (external.storageType === StorageKey.CALIBRE ||
        $autoReplication$ === AutoReplicationType.Up ||
        $autoReplication$ === AutoReplicationType.All);

    if (upSync) {
      const error = await replicateData(
        local,
        external!,
        false,
        [context()],
        [StorageDataType.PROGRESS]
      ).catch((err: any) => err.message);

      if (error) logger.warn(`Manga progress sync failed: ${error}`);
    }
  }

  function goToPage(index: number) {
    pageIndex = Math.max(0, Math.min(pageCount - 1, index));

    if (mode === 'vertical') {
      strip?.children[pageIndex]?.scrollIntoView();
    }
  }

  async function scrollStripOnModeChange(_mode: MangaReadingMode) {
    // The strip is rendered after the mode changes; keep the page.
    await tick();
    goToPage(pageIndex);
  }

  function onStripScroll() {
    if (!strip) return;

    const middle = strip.getBoundingClientRect().top + strip.clientHeight / 2;
    const pages = [...strip.children];
    const index = pages.findIndex((img) => img.getBoundingClientRect().bottom > middle);

    pageIndex = index === -1 ? pages.length - 1 : index;
  }

  // ---- paged layout ----

  function groupSize(
    index: number,
    allGroups: number[][],
    allSizes: (PageSize | undefined)[],
    scale: MangaScale,
    viewSize: PageSize
  ) {
    const group = allGroups[index];

    if (!group || !viewSize.width) return { width: 0, height: 0 };

    return fitSize(
      scale,
      group.map((i) => allSizes[i] ?? unknownSize),
      viewSize
    );
  }

  /** Where a page starts: its top, and its right edge in right-to-left manga. */
  function startPan(size: PageSize) {
    return {
      x: clampPan(mode === 'rtl' ? -Infinity : 0, size.width, viewWidth),
      y: clampPan(0, size.height, viewHeight)
    };
  }

  let viewKey = '';

  /** Back to the start of a spread when it or its size changes, not as the other pages are measured. */
  function resetView(index: number, size: PageSize, force = false) {
    const key = `${index} ${size.width} ${size.height} ${mode}`;

    if (key === viewKey && !force) return;

    viewKey = key;
    zoom = 1;
    pan = startPan(size);
  }

  function setPan(x: number, y: number) {
    pan = {
      x: clampPan(x, base.width * zoom, viewWidth),
      y: clampPan(y, base.height * zoom, viewHeight)
    };
  }

  /** Zooms keeping the point (x, y) of the screen where it is. */
  function zoomAt(value: number, x: number, y: number) {
    const next = Math.max(1, Math.min(maxZoom, value));
    const ratio = next / zoom;

    zoom = next;
    setPan(x - (x - pan.x) * ratio, y - (y - pan.y) * ratio);
  }

  /** Decodes the pages a few spreads either way, so turning to them is instant. */
  const decoded = new Map<number, HTMLImageElement>();

  function preload(allGroups: number[][], index: number) {
    if (mode === 'vertical') return;

    const wanted = new Set(allGroups.slice(Math.max(0, index - 3), index + 4).flat());

    wanted.forEach((page) => {
      if (decoded.has(page) || !urls[page]) return;

      const img = new Image();

      img.src = urls[page];
      img.decode().catch(() => {});
      decoded.set(page, img);
    });
    decoded.forEach((_img, page) => {
      if (!wanted.has(page)) decoded.delete(page);
    });
  }

  let sampled = '';

  async function sampleBackground(url: string | undefined) {
    if (!url || url === sampled) return;

    sampled = url;

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    img.src = url;
    await img.decode().catch(() => {});

    if (!ctx || sampled !== url || !img.naturalWidth) return;

    canvas.width = canvas.height = 16;
    ctx.drawImage(img, 0, 0, 16, 16);
    autoBackground = borderColor(ctx.getImageData(0, 0, 16, 16).data, 16);
  }

  // ---- turning ----

  let turnTimer: ReturnType<typeof setTimeout> | undefined;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Turns by whole spreads (dir 1 forward), sliding the track along unless motion is reduced. */
  function turn(dir: number) {
    const target = groups[groupIndex + dir];

    if (mode === 'vertical') {
      goToPage(pageIndex + dir);
      return;
    }

    if (!target || turnTimer) return;

    if (prefersReducedMotion()) {
      pageIndex = target[0];
      return;
    }

    animating = true;
    dragX = -dir * viewWidth * sign;
    turnTimer = setTimeout(() => {
      turnTimer = undefined;
      animating = false;
      dragX = 0;
      pageIndex = target[0];
    }, turnMs);
  }

  function snapBack() {
    animating = true;
    dragX = 0;
    turnTimer = setTimeout(() => {
      turnTimer = undefined;
      animating = false;
    }, turnMs);
  }

  // ---- gestures (paged modes) ----

  type Gesture =
    | { kind: 'pending' | 'pan' | 'swipe'; x: number; y: number; panX: number; panY: number }
    | {
        kind: 'pinch';
        distance: number;
        zoom: number;
        x: number;
        y: number;
        panX: number;
        panY: number;
      };

  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: Gesture | undefined;
  let lastTap: { x: number; y: number; time: number } | undefined;
  let tapTimer: ReturnType<typeof setTimeout> | undefined;
  let lastWheelTurn = 0;

  function pinchState() {
    const [a, b] = [...pointers.values()];

    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function startDrag(x: number, y: number): Gesture {
    return { kind: 'pending', x, y, panX: pan.x, panY: pan.y };
  }

  /** Whether dragging by dx would move the page rather than push against its edge. */
  function canPanX(dx: number) {
    if (content.width <= viewWidth + 1) return false;

    return dx > 0 ? pan.x < -1 : pan.x > viewWidth - content.width + 1;
  }

  function onPointerDown(event: PointerEvent) {
    if (mode === 'vertical') {
      pointerStart = { x: event.clientX, y: event.clientY };
      return;
    }

    if (turnTimer) return;

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      gesture = startDrag(event.clientX, event.clientY);
    } else if (pointers.size === 2) {
      dragX = 0;
      const start = pinchState();

      gesture = { kind: 'pinch', ...start, zoom, panX: pan.x, panY: pan.y };
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!gesture || !pointers.has(event.pointerId)) return;

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture.kind === 'pinch') {
      if (pointers.size < 2) return;

      // The point under the fingers when the pinch began stays under them.
      const now = pinchState();
      const next = Math.max(1, Math.min(maxZoom, (gesture.zoom * now.distance) / gesture.distance));
      const ratio = next / gesture.zoom;

      zoom = next;
      setPan(
        now.x - (gesture.x - gesture.panX) * ratio,
        now.y - (gesture.y - gesture.panY) * ratio
      );
      return;
    }

    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;

    if (gesture.kind === 'pending') {
      if (Math.hypot(dx, dy) < 10) return;

      const horizontal = Math.abs(dx) > Math.abs(dy);

      gesture = { ...gesture, kind: horizontal && !canPanX(dx) ? 'swipe' : 'pan' };
    }

    if (gesture.kind === 'pan') {
      setPan(gesture.panX + dx, gesture.panY + dy);
    } else {
      // Past the first or last spread the page only gives a little.
      const dir = (dx < 0 ? 1 : -1) * sign;

      dragX = groups[groupIndex + dir] ? dx : dx / 4;
    }
  }

  function onPointerUp(event: PointerEvent, cancelled = false) {
    if (mode === 'vertical') {
      if (!cancelled) stripPointerUp(event);
      return;
    }

    if (!pointers.delete(event.pointerId) || !gesture) return;

    if (gesture.kind === 'pinch') {
      // One finger left keeps panning from where it is.
      const [rest] = [...pointers.values()];

      gesture = rest ? { ...startDrag(rest.x, rest.y), kind: 'pan' } : undefined;
      return;
    }

    if (pointers.size) return;

    const ended = gesture;

    gesture = undefined;

    if (cancelled) {
      if (ended.kind === 'swipe') snapBack();
    } else if (ended.kind === 'pending') {
      tap(event.clientX, event.clientY);
    } else if (ended.kind === 'swipe') {
      const dir = (dragX < 0 ? 1 : -1) * sign;

      if (Math.abs(dragX) > Math.min(80, viewWidth / 5) && groups[groupIndex + dir]) {
        showMenu = false;
        turn(dir);
      } else {
        snapBack();
      }
    }
  }

  function tap(x: number, y: number) {
    if (!$mangaDoubleTapZoom$) {
      singleTap(x);
      return;
    }

    const now = Date.now();

    if (lastTap && now - lastTap.time < 300 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40) {
      clearTimeout(tapTimer);
      lastTap = undefined;

      if (zoom > 1) resetView(groupIndex, base, true);
      else zoomAt(2.5, x, y);

      return;
    }

    lastTap = { x, y, time: now };
    clearTimeout(tapTimer);
    // Waits to see whether a second tap makes it a double tap.
    tapTimer = setTimeout(() => singleTap(x), 300);
  }

  /** The sides turn the page, unless zoomed in; the middle toggles the menu. */
  function singleTap(x: number) {
    const dir = zoom > 1 ? 0 : tapDirection(x, viewWidth, mode);

    if (dir) {
      turn(dir);
      showMenu = false;
    } else {
      showMenu = !showMenu;
    }
  }

  function stripPointerUp(event: PointerEvent) {
    if (!pointerStart) return;

    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;

    pointerStart = undefined;

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      showMenu = !showMenu;
    }
  }

  function onWheel(event: WheelEvent) {
    if (mode === 'vertical') return;

    event.preventDefault();

    if (event.ctrlKey) {
      // Also trackpad pinches, which browsers send as Ctrl+wheel.
      zoomAt(zoom * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
    } else if (overflows) {
      setPan(pan.x - event.deltaX, pan.y - event.deltaY);
    } else if (Math.abs(event.deltaY) > 4 && Date.now() - lastWheelTurn > 400) {
      lastWheelTurn = Date.now();
      turn(Math.sign(event.deltaY));
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
      turn(1);
    } else if (event.key === back || event.key === 'PageUp') {
      turn(-1);
    } else {
      return;
    }

    event.preventDefault();
  }

  // ---- screen ----

  async function updateWakeLock(keepOn: boolean) {
    if (!wakeLockSupported) return;

    if (keepOn && document.visibilityState === 'visible') {
      if (wakeLock && !wakeLock.released) return;

      wakeLock = await navigator.wakeLock.request('screen').catch(({ message }) => {
        logger.warn(`Could not keep the screen on: ${message}`);

        return undefined;
      });
    } else {
      await wakeLock?.release().catch(() => {});
      wakeLock = undefined;
    }
  }

  function toggleFullscreen() {
    if (fullscreenManager.fullscreenElement) fullscreenManager.exitFullscreen();
    else fullscreenManager.requestFullscreen(document.documentElement);
  }

  async function leave() {
    await save().catch((error) => logger.warn(error.message));
    await database.deleteLastItem();
    goto(`${pagePath}/manage`);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') save();
    // The browser drops the lock when the page is hidden.
    updateWakeLock($mangaKeepScreenOn$);
  }

  onMount(() => {
    load(Number($page.url.searchParams.get('id'))).catch((error) =>
      logger.error(`Error loading manga: ${error.message}`)
    );
  });

  onDestroy(() => {
    save();
    clearTimeout(tapTimer);
    clearTimeout(turnTimer);
    decoded.clear();
    updateWakeLock(false);
    urls.forEach((url) => URL.revokeObjectURL(url));
  });
</script>

<svelte:head>
  <title>{formatPageTitle(book?.title ?? '')}</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} />
<svelte:document on:visibilitychange={onVisibilityChange} />

<div
  class="fixed inset-0 select-none overflow-hidden"
  style:background
  style:touch-action={mode === 'vertical' ? 'pan-y pinch-zoom' : 'none'}
  bind:clientWidth={viewWidth}
  bind:clientHeight={viewHeight}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={(event) => onPointerUp(event)}
  on:pointercancel={(event) => onPointerUp(event, true)}
  on:wheel|nonpassive={onWheel}
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
  {:else}
    <!-- The spreads either side are laid out beside this one, so a swipe drags them in. -->
    {#each slots as index (index)}
      <div
        class="absolute left-0 top-0 flex"
        class:flex-row-reverse={mode === 'rtl'}
        style={slotStyle(index)}
      >
        {#each groups[index] as pageNumber (pageNumber)}
          <img
            src={urls[pageNumber]}
            alt="Page {pageNumber + 1}"
            draggable="false"
            class="h-full w-auto max-w-none flex-none"
          />
        {/each}
      </div>
    {/each}
  {/if}
</div>

{#if $mangaPageNumber$ && !showMenu && pageCount}
  <div
    class="reader-panel pointer-events-none fixed bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs tabular-nums opacity-80"
  >
    {shownPages.map((index) => index + 1).join('–')} / {pageCount}
  </div>
{/if}

{#if showMenu}
  <div
    class="reader-panel fixed inset-x-0 top-0 flex items-center gap-3 px-3 py-2"
    transition:fly={{ y: -40, duration: 150 }}
  >
    <button class="p-2" title="Back to the library" aria-label="Back" on:click={leave}>
      <Fa icon={faArrowLeft} />
    </button>
    <div class="min-w-0 flex-1 truncate">{book?.title ?? ''}</div>
    {#if fullscreenManager.fullscreenEnabled}
      <button class="p-2" title="Full screen" aria-label="Full screen" on:click={toggleFullscreen}>
        <Fa icon={faExpand} />
      </button>
    {/if}
    <button
      class="p-2"
      title="Reader settings"
      aria-label="Reader settings"
      aria-expanded={showSettings}
      on:click={() => (showSettings = !showSettings)}
    >
      <Fa icon={faGear} />
    </button>
  </div>

  <div
    class="reader-panel fixed inset-x-0 bottom-0 flex flex-col gap-3 px-4 py-3"
    transition:fly={{ y: 40, duration: 150 }}
  >
    {#if showSettings}
      <div class="max-h-[55vh] overflow-y-auto">
        <SettingsItemGroup title="Reading mode">
          <ButtonToggleGroup options={modes} bind:selectedOptionId={$mangaReadingMode$} />
        </SettingsItemGroup>
        {#if mode !== 'vertical'}
          <SettingsItemGroup title="Scale">
            <ButtonToggleGroup options={scales} bind:selectedOptionId={$mangaScale$} />
          </SettingsItemGroup>
          <SettingsItemGroup
            title="Two pages"
            tooltip="Auto shows spreads on screens wider than tall. Shift pairs the cover too, for spreads that are off by one."
          >
            <ButtonToggleGroup options={dualPages} bind:selectedOptionId={$mangaDualPage$} />
            {#if dual}
              <button
                class="app-button ml-2"
                aria-pressed={shift}
                on:click={() => (shift = !shift)}
              >
                Shift
              </button>
            {/if}
          </SettingsItemGroup>
          <SettingsItemGroup title="Double tap to zoom" tooltip="Single taps then wait a moment.">
            <ButtonToggleGroup
              options={optionsForToggle}
              bind:selectedOptionId={$mangaDoubleTapZoom$}
            />
          </SettingsItemGroup>
        {/if}
        <SettingsItemGroup title="Background">
          <ButtonToggleGroup options={backgrounds} bind:selectedOptionId={$mangaBackground$} />
        </SettingsItemGroup>
        {#if wakeLockSupported}
          <SettingsItemGroup title="Keep the screen on">
            <ButtonToggleGroup
              options={optionsForToggle}
              bind:selectedOptionId={$mangaKeepScreenOn$}
            />
          </SettingsItemGroup>
        {/if}
        <SettingsItemGroup title="Page number">
          <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={$mangaPageNumber$} />
        </SettingsItemGroup>
      </div>
    {/if}
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
  </div>
{/if}
