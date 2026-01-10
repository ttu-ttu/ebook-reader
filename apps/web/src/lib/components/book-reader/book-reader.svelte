<script lang="ts">
  import {
    animationFrameScheduler,
    combineLatest,
    debounceTime,
    filter,
    map,
    mergeMap,
    of,
    ReplaySubject,
    share,
    shareReplay,
    startWith,
    Subject,
    tap
  } from 'rxjs';
  import BookReaderContinuous from '$lib/components/book-reader/book-reader-continuous/book-reader-continuous.svelte';
  import { pxReader } from '$lib/components/book-reader/css-classes';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import type { FuriganaStyle } from '$lib/data/furigana-style';
  import { ViewMode } from '$lib/data/view-mode';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import { writableSubject } from '$lib/functions/svelte/store';
  import { convertRemToPixels } from '$lib/functions/utils';
  import { logger } from '$lib/data/logger';
  import { imageLoadingState } from './image-loading-state';
  import { reactiveElements } from './reactive-elements';
  import type { AutoScroller, BookmarkManager, PageManager } from './types';
  import BookReaderPaginated from './book-reader-paginated/book-reader-paginated.svelte';
  import {
    ankiConnectUrl$,
    ankiIntegrationEnabled$,
    ankiMatureThreshold$,
    ankiTokenStyle$,
    ankiWordFields$,
    ankiWordDeckNames$,
    enableReaderWakeLock$,
    enableTapEdgeToFlip$,
    yomitanUrl$
  } from '$lib/data/store';
  import {
    BookContentColoring,
    ColoringPriorityQueue,
    ProcessingPriority
  } from '$lib/functions/anki';
  import { createAnkiCacheDb, AnkiCacheService } from '$lib/data/database/anki-cache-db';
  import { onDestroy } from 'svelte';

  export let htmlContent: string;

  export let width: number;

  export let height: number;

  export let verticalMode: boolean;

  export let fontFeatureSettings: string;

  export let verticalTextOrientation: string;

  export let prioritizeReaderStyles: boolean;

  export let enableTextJustification: boolean;

  export let enableTextWrapPretty: boolean;

  export let textIndentation: number;

  export let textMarginValue: number;

  export let fontColor: string;

  export let backgroundColor: string;

  export let hintFuriganaFontColor: string;

  export let hintFuriganaShadowColor: string;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let fontSize: number;

  export let lineHeight: number;

  export let hideSpoilerImage: boolean;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let autoPositionOnResize: boolean;

  export let avoidPageBreak: boolean;

  export let pageColumns: number;

  export let autoBookmark: boolean;

  export let autoBookmarkTime: number;

  export let viewMode: ViewMode;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let multiplier: number;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let autoScroller: AutoScroller | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let pageManager: PageManager | undefined;

  export let isBookmarkScreen: boolean;

  export let customReadingPoint: number;

  export let customReadingPointTop: number;

  export let customReadingPointLeft: number;

  export let customReadingPointScrollOffset: number;

  export let customReadingPointRange: Range | undefined;

  export let showCustomReadingPoint: boolean;

  let showBlurMessage = false;

  let wakeLock: WakeLockSentinel | undefined;

  let visibilityState: DocumentVisibilityState;

  // Initialize Anki cache service for persistent caching
  const ankiCacheDb = createAnkiCacheDb();
  const ankiCacheService = new AnkiCacheService(ankiCacheDb);

  let coloringService: BookContentColoring | undefined;
  let coloringQueue: ColoringPriorityQueue | undefined;
  let intersectionObserver: IntersectionObserver | undefined;
  let viewportObserver: IntersectionObserver | undefined;
  let nearObserver: IntersectionObserver | undefined;

  const mutationObserver: MutationObserver = new MutationObserver(handleMutation);

  const width$ = new Subject<number>();

  const height$ = new Subject<number>();

  const containerEl$ = writableSubject<HTMLElement | null>(null);

  $: heightModifer =
    firstDimensionMargin && ViewMode.Paginated === viewMode && !verticalMode
      ? firstDimensionMargin * 2
      : 0;

  // Anki word coloring - incremental viewport-based approach with priority queue
  let cacheLoadingPromise: Promise<void> | null = null;

  $: if ($ankiIntegrationEnabled$) {
    // Initialize coloring service with persistent cache
    if (!coloringService && !cacheLoadingPromise) {
      console.log('🔧 Creating Anki coloring service...');

      coloringService = new BookContentColoring(
        {
          enabled: true,
          yomitanUrl: $yomitanUrl$,
          ankiConnectUrl: $ankiConnectUrl$,
          wordFields: $ankiWordFields$,
          wordDeckNames: $ankiWordDeckNames$,
          matureThreshold: $ankiMatureThreshold$,
          tokenStyle: $ankiTokenStyle$
        },
        ankiCacheService
      );

      // Step 1: Check if IndexedDB cache exists (no preloading)
      console.log('⚡ Checking IndexedDB cache status...');
      cacheLoadingPromise = (async () => {
        const service = coloringService; // Capture reference
        if (!service) {
          console.error('⚠️ Service is null, cannot check cache');
          return;
        }

        console.log('⚡ Calling loadCacheFromIndexedDB...');
        const cacheInfo = await service.loadCacheFromIndexedDB();
        console.log(`⚡ loadCacheFromIndexedDB returned:`, cacheInfo);

        if (cacheInfo.loadedWords === 0) {
          console.log(
            `⚡ Cache exists (age: ${Math.round(cacheInfo.cacheAge / 60000)} min) - queries will use IndexedDB on-demand`
          );
        } else {
          console.log('⚠️ No cache found - will query Anki after warming');
        }

        // Step 2: Start colorization immediately
        // IndexedDB queries happen on-demand, no need to wait for preloading
        if (!coloringQueue && service) {
          console.log(`🎨 Starting colorization with IndexedDB as primary cache...`);
          // maxConcurrent: 1 batch at a time (avoid Anki freezing)
          // batchSize: 5 elements per batch (smaller batches, faster feedback)
          // Tokens are chunked to 10 per Anki query for stability
          coloringQueue = new ColoringPriorityQueue(service, 1, 5);
        }

        // Step 3: Refresh cache in background (don't block colorization)
        if (cacheInfo.needsRefresh) {
          console.log('🔄 Refreshing cache from Anki in background...');
          service
            .warmCache()
            .then(async (stats) => {
              console.log(
                `✅ Cache refreshed: ${stats.cachedWords} words from ${stats.totalCards} cards in ${stats.duration}ms`
              );

              // Re-colorize all elements to pick up updated cards
              console.log('🔄 Re-colorizing with updated cache...');
              await service.recolorizeProcessedElements();
              console.log('✅ Re-colorization complete');
            })
            .catch((err) => {
              console.error('❌ Failed to refresh cache:', err);
            });
        }

        cacheLoadingPromise = null;
      })().catch((err) => {
        console.error('❌ Failed to initialize cache:', err);
        console.error('Error stack:', err.stack);
        cacheLoadingPromise = null;
      });
    }
  } else {
    // Clean up when disabled
    if (coloringQueue) {
      coloringQueue.clear();
      coloringQueue = undefined;
    }
    if (coloringService) {
      // coloringService.clearCache();
      coloringService = undefined;
    }
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = undefined;
    }
    if (viewportObserver) {
      viewportObserver.disconnect();
      viewportObserver = undefined;
    }
    if (nearObserver) {
      nearObserver.disconnect();
      nearObserver = undefined;
    }
  }

  // Setup priority-based intersection observers when content element changes
  $: if ($ankiIntegrationEnabled$ && coloringQueue) {
    contentEl$.subscribe((element) => {
      if (!element) return;

      // Clean up previous observers
      if (viewportObserver) {
        viewportObserver.disconnect();
      }
      if (nearObserver) {
        nearObserver.disconnect();
      }
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }

      // Helper to calculate distance from viewport
      const calculateDistance = (entry: IntersectionObserverEntry): number => {
        const rect = entry.boundingClientRect;
        const viewportHeight = window.innerHeight;

        if (rect.top > viewportHeight) {
          return rect.top - viewportHeight; // Below viewport
        } else if (rect.bottom < 0) {
          return Math.abs(rect.bottom); // Above viewport
        }
        return 0; // In viewport
      };

      // Observer 1: VIEWPORT (currently visible) - highest priority
      viewportObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && coloringQueue) {
              coloringQueue.enqueue(entry.target as Element, ProcessingPriority.VIEWPORT, 0);
            }
          });
        },
        { root: null, rootMargin: '0px', threshold: 0.01 }
      );

      // Observer 2: NEAR (within 500px) - medium priority
      nearObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const distance = calculateDistance(entry);

            if (entry.isIntersecting && coloringQueue) {
              coloringQueue.enqueue(entry.target as Element, ProcessingPriority.NEAR, distance);
            } else if (distance > 1500 && coloringQueue) {
              // Scrolled far away, remove from queue
              coloringQueue.dequeue(entry.target as Element);
            }
          });
        },
        { root: null, rootMargin: '500px', threshold: 0 }
      );

      // Observer 3: PREFETCH (within 1000px) - low priority
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && coloringQueue) {
              const distance = calculateDistance(entry);
              coloringQueue.enqueue(entry.target as Element, ProcessingPriority.PREFETCH, distance);
            } else if (coloringQueue) {
              // Left prefetch zone, remove from queue
              coloringQueue.dequeue(entry.target as Element);
            }
          });
        },
        { root: null, rootMargin: '1000px', threshold: 0 }
      );

      // Observe all paragraphs and divs with all three observers
      const elementsToObserve = element.querySelectorAll('p, div.paragraph, div.section');
      elementsToObserve.forEach((el) => {
        viewportObserver?.observe(el);
        nearObserver?.observe(el);
        intersectionObserver?.observe(el);
      });
    });
  }

  $: if ($enableReaderWakeLock$ && visibilityState === 'visible') {
    setTimeout(requestWakeLock, 500);
  }

  onDestroy(() => {
    mutationObserver.disconnect();

    releaseWakeLock();

    // Clean up all intersection observers
    if (intersectionObserver) {
      intersectionObserver.disconnect();
    }
    if (viewportObserver) {
      viewportObserver.disconnect();
    }
    if (nearObserver) {
      nearObserver.disconnect();
    }

    // Clean up priority queue
    if (coloringQueue) {
      coloringQueue.clear();
    }

    // Clean up coloring service
    if (coloringService) {
      // coloringService.clearCache();
    }
  });

  const computedStyle$ = combineLatest([
    containerEl$.pipe(filter((el): el is HTMLElement => !!el)),
    combineLatest([width$, height$]).pipe(startWith(0))
  ]).pipe(
    debounceTime(0, animationFrameScheduler),
    map(([el]) => getComputedStyle(el)),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const contentEl$ = new ReplaySubject<HTMLElement>(1);

  const contentViewportWidth$ = computedStyle$.pipe(
    map((style) =>
      getAdjustedWidth(
        width -
          parsePx(style.paddingLeft) -
          parsePx(style.paddingRight) -
          ($enableTapEdgeToFlip$ && ViewMode.Paginated === viewMode && !verticalMode
            ? convertRemToPixels(window, 1.75)
            : 0)
      )
    )
  );

  const contentViewportHeight$ = computedStyle$.pipe(
    map((style) =>
      getAdjustedHeight(
        height - parsePx(style.paddingTop) - parsePx(style.paddingBottom) - heightModifer
      )
    )
  );

  const reactiveElements$ = iffBrowser(() => of(document)).pipe(
    mergeMap((document) => {
      const reactiveElementsFn = reactiveElements(
        document,
        furiganaStyle,
        hideSpoilerImage,
        navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches
      );
      return contentEl$.pipe(mergeMap((contentEl) => reactiveElementsFn(contentEl)));
    }),
    reduceToEmptyString()
  );

  const imageLoadingState$ = contentEl$.pipe(
    mergeMap((contentEl) => imageLoadingState(contentEl)),
    share()
  );

  const blurListener$ = contentEl$.pipe(
    tap((contentEl) => {
      mutationObserver.disconnect();
      mutationObserver.observe(contentEl, { attributes: true });
    }),
    reduceToEmptyString()
  );

  $: width$.next(width);

  $: height$.next(height);

  function getAdjustedWidth(widthValue: number) {
    if (ViewMode.Paginated === viewMode && !verticalMode && secondDimensionMaxValue) {
      return Math.min(secondDimensionMaxValue, widthValue);
    }
    return widthValue;
  }

  function getAdjustedHeight(heightValue: number) {
    if (ViewMode.Paginated === viewMode && verticalMode && secondDimensionMaxValue) {
      return Math.min(secondDimensionMaxValue, heightValue);
    }
    return heightValue;
  }

  function parsePx(px: string) {
    return Number(px.replace(/px$/, ''));
  }

  function handleMutation([mutation]: MutationRecord[]) {
    if (!(mutation.target instanceof HTMLElement)) {
      showBlurMessage = false;
      return;
    }

    showBlurMessage = mutation.target.style.filter.includes('blur');
  }

  async function requestWakeLock() {
    if (wakeLock && !wakeLock.released) {
      return;
    }

    wakeLock = await navigator.wakeLock.request().catch(({ message }) => {
      logger.error(`failed to request wakelock: ${message}`);

      return undefined;
    });

    if (wakeLock) {
      wakeLock.addEventListener('release', releaseWakeLock, false);
    }
  }

  async function releaseWakeLock() {
    if (wakeLock && !wakeLock.released) {
      await wakeLock.release().catch(() => {
        // no-op
      });
    }

    wakeLock = undefined;
  }
</script>

{#if showBlurMessage}
  <div
    class="fixed top-12 right-4 p-2 border max-w-[90vw] z-[1]"
    style:writing-mode="horizontal-tb"
    style:color={fontColor}
    style:background-color={backgroundColor}
    style:border-color={fontColor}
  >
    The reader is currently blurred due to an external application (e. g. exstatic)
  </div>
{/if}
<div bind:this={$containerEl$} class="{pxReader} py-8">
  {#if viewMode === ViewMode.Continuous}
    <BookReaderContinuous
      {htmlContent}
      width={$contentViewportWidth$ ?? 0}
      height={$contentViewportHeight$ ?? 0}
      {verticalMode}
      {fontFeatureSettings}
      {verticalTextOrientation}
      {prioritizeReaderStyles}
      {enableTextJustification}
      {enableTextWrapPretty}
      {fontColor}
      {backgroundColor}
      {hintFuriganaFontColor}
      {hintFuriganaShadowColor}
      {fontFamilyGroupOne}
      {fontFamilyGroupTwo}
      {fontSize}
      {lineHeight}
      {textIndentation}
      {textMarginValue}
      {hideSpoilerImage}
      {hideFurigana}
      {furiganaStyle}
      {secondDimensionMaxValue}
      {firstDimensionMargin}
      {autoPositionOnResize}
      {autoBookmark}
      {autoBookmarkTime}
      {multiplier}
      loadingState={$imageLoadingState$ ?? true}
      bind:exploredCharCount
      bind:bookCharCount
      bind:bookmarkData
      bind:autoScroller
      bind:bookmarkManager
      bind:pageManager
      bind:customReadingPoint
      bind:customReadingPointTop
      bind:customReadingPointLeft
      bind:customReadingPointScrollOffset
      on:contentChange={(ev) => contentEl$.next(ev.detail)}
      on:bookmark
      on:trackerPause
    />
  {:else}
    <BookReaderPaginated
      {htmlContent}
      width={$contentViewportWidth$ ?? 0}
      height={$contentViewportHeight$ ?? 0}
      {verticalMode}
      {fontFeatureSettings}
      {verticalTextOrientation}
      {prioritizeReaderStyles}
      {enableTextJustification}
      {enableTextWrapPretty}
      {fontColor}
      {backgroundColor}
      {hintFuriganaFontColor}
      {hintFuriganaShadowColor}
      {fontFamilyGroupOne}
      {fontFamilyGroupTwo}
      {fontSize}
      {lineHeight}
      {textIndentation}
      {textMarginValue}
      {hideSpoilerImage}
      {hideFurigana}
      {furiganaStyle}
      loadingState={$imageLoadingState$ ?? true}
      {avoidPageBreak}
      {pageColumns}
      {autoBookmark}
      {autoBookmarkTime}
      {firstDimensionMargin}
      bind:exploredCharCount
      bind:bookCharCount
      bind:isBookmarkScreen
      bind:bookmarkData
      bind:bookmarkManager
      bind:pageManager
      bind:customReadingPointRange
      bind:showCustomReadingPoint
      on:contentChange={(ev) => contentEl$.next(ev.detail)}
      on:bookmark
      on:trackerPause
    />
  {/if}
</div>
{$blurListener$ ?? ''}
{$reactiveElements$ ?? ''}
<svelte:document bind:visibilityState />
