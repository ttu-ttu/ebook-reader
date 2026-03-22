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
  import BookReaderTokenPanel from './book-reader-token-panel.svelte';
  import { imageLoadingState } from './image-loading-state';
  import { reactiveElements } from './reactive-elements';
  import type { AutoScroller, BookmarkManager, PageManager } from './types';
  import BookReaderPaginated from './book-reader-paginated/book-reader-paginated.svelte';
  import {
    ankiConnectUrl$,
    ankiColorMode$,
    ankiColorPalette$,
    ankiDesiredRetention$,
    ankiIntegrationEnabled$,
    ankiMatureThreshold$,
    ankiTokenStyle$,
    ankiWordFields$,
    ankiWordDeckNames$,
    enableReaderWakeLock$,
    enableTapEdgeToFlip$,
    yomitanUrl$
  } from '$lib/data/store';
  import { TokenColorMode, TokenColorPalette } from '$lib/data/anki/token-color';
  import {
    BookContentColoring,
    ColoringPriorityQueue,
    type DocumentTokenAnalysisEntry,
    type DocumentTokenAnalysisProgress,
    type DocumentTokenAnalysisResult,
    type DocumentTokenizeProgress,
    type DocumentTokenStatus,
    type WarmCacheProgress,
    ProcessingPriority
  } from '$lib/functions/anki';
  import { createAnkiCacheDb, AnkiCacheService } from '$lib/data/database/anki-cache-db';
  import { createEventDispatcher, onDestroy, tick } from 'svelte';

  export let htmlContent: string;

  export let width: number;

  export let height: number;

  export let verticalMode: boolean;

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

  export let showTokenPanel = false;

  const dispatch = createEventDispatcher<{
    tokenPanelClose: void;
  }>();

  interface TokenPanelSentenceMatch {
    sentence: string;
    page: number | null;
  }

  type RepositionStartMode = 'bookmark' | 'start';
  type RepositionRangeMode = 'to-end' | 'tokens' | 'chars' | 'percent';
  type RepositionOrderMode = 'book-order' | 'occurrences';

  interface RepositionSummary {
    requested: number;
    deduped: number;
    eligibleNew: number;
    repositioned: number;
    skippedNotFound: number[];
    skippedNotNew: number[];
    processedTokens: number;
    uniqueTokens: number;
    processedChars: number;
    startOffset: number;
    effectiveMaxChars: number;
    effectiveMaxTokens: number | null;
    orderMode: RepositionOrderMode;
    minOccurrences: number;
  }

  type TokenPanelFilterId = 'all' | 'due' | DocumentTokenStatus;
  type TokenPanelOrthographyFilterId = 'all-scripts' | 'has-kanji';
  type TokenPanelSortId = 'frequency' | 'book-order';

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
  let previousAnkiColorMode: TokenColorMode | undefined;
  let previousAnkiColorPalette: TokenColorPalette | undefined;
  let previousAnkiDesiredRetention: number | undefined;
  let previousAnkiMatureThreshold: number | undefined;
  let tokenPanelProgress: DocumentTokenAnalysisProgress | undefined;
  let tokenPanelResult: DocumentTokenAnalysisResult | undefined;
  let tokenPanelError = '';
  let tokenPanelLoading = false;
  let tokenPanelAnalysisAbortController: AbortController | undefined;
  let tokenPanelAnalysisKey = '';
  let tokenPanelCacheVersion = 0;
  let tokenPanelActiveFilter: TokenPanelFilterId = 'all';
  let tokenPanelActiveOrthographyFilter: TokenPanelOrthographyFilterId = 'all-scripts';
  let tokenPanelActiveSort: TokenPanelSortId = 'frequency';
  let tokenPanelActiveToken: string | null = null;
  let tokenPanelSentenceMatches: Record<string, TokenPanelSentenceMatch[]> = {};
  let tokenPanelSentenceLoadingToken: string | null = null;
  let tokenPanelSentenceSourceKey = '';
  let tokenPanelDocumentSentences: string[] = [];
  const tokenPanelHoverRefreshCooldownMs = 2500;
  const tokenPanelJumpHasLetterRegex = /\p{L}/u;
  const tokenPanelJumpHasKanjiRegex = /[\p{Script=Han}々]/u;
  let tokenPanelHoverRefreshSuppressedUntilMs = 0;
  let tokenPanelLastHoverRefresh = new Map<string, number>();
  const tokenPanelFilterStorageKey = 'book-reader-token-panel-filter-v1';
  const tokenPanelOrthographyFilterStorageKey = 'book-reader-token-panel-orthography-filter-v1';
  const tokenPanelSortStorageKey = 'book-reader-token-panel-sort-v1';
  let tokenPanelBookmarkShift = 0;
  let tokenPanelBookmarkShiftRaf: number | undefined;
  let tokenPanelBaseAnchorLeft: number | undefined;
  let tokenPanelBookmarkShiftTimeout: ReturnType<typeof setTimeout> | undefined;
  let repositionDialogOpen = false;
  let repositionLoading = false;
  let repositionError = '';
  let repositionSummary: RepositionSummary | undefined;
  let repositionStartMode: RepositionStartMode = 'bookmark';
  let repositionRangeMode: RepositionRangeMode = 'to-end';
  let repositionOrderMode: RepositionOrderMode = 'book-order';
  let repositionMinOccurrences = 2;
  let repositionTokenLimit = 1200;
  let repositionCharLimit = 40000;
  let repositionCharPercent = 20;
  let repositionStartPosition = 1;
  let repositionStep = 1;
  let repositionShift = true;
  let initialTokenizeProgress: DocumentTokenizeProgress | undefined;
  let initialTokenizeLoading = false;
  let initialTokenizeAbortController: AbortController | undefined;
  let initialTokenizePromise: Promise<void> | null = null;
  const initialTokenizeCompletedKeys = new Set<string>();
  let initialTokenizeActiveKey = '';
  let initialStatusColoringLoading = false;
  let initialStatusColoringSeenWork = false;
  let initialStatusColoringCompleted = false;
  let initialStatusColoringMaxWork = 0;
  let initialStatusColoringProgress = 0;
  let initialStatusColoringQueueTotal = 0;
  let initialStatusColoringMonitor: ReturnType<typeof setInterval> | undefined;
  let initialStatusColoringDocKey = '';
  let warmCacheLoading = false;
  let warmCacheProgress: WarmCacheProgress | undefined;
  let tokenPanelWordDataPrimed = false;
  let tokenPanelWordDataPrimingPromise: Promise<void> | null = null;
  let readerPreparationLoading = false;
  let readerPreparationLabel = 'Preparing token index';
  let readerPreparationPercentage = 0;
  let readerPreparationDetail = 'Step 0 / 0';

  function getColoringDocKey(html: string): string {
    return [html.length, html.slice(0, 256), html.slice(-256)].join('::');
  }

  function resetInitialStatusColoringState(): void {
    initialStatusColoringLoading = false;
    initialStatusColoringSeenWork = false;
    initialStatusColoringCompleted = false;
    initialStatusColoringMaxWork = 0;
    initialStatusColoringProgress = 0;
    initialStatusColoringQueueTotal = 0;
  }

  function stopInitialStatusColoringMonitor(): void {
    if (initialStatusColoringMonitor) {
      clearInterval(initialStatusColoringMonitor);
      initialStatusColoringMonitor = undefined;
    }
  }

  function startInitialStatusColoringMonitor(): void {
    if (initialStatusColoringMonitor) {
      return;
    }

    initialStatusColoringMonitor = setInterval(() => {
      if (!$ankiIntegrationEnabled$ || initialStatusColoringCompleted || !coloringQueue) {
        return;
      }

      const stats = coloringQueue.getStats();
      const totalWork = stats.queued + stats.processing;
      initialStatusColoringQueueTotal = totalWork;

      if (totalWork > 0) {
        initialStatusColoringSeenWork = true;
        initialStatusColoringLoading = true;
        initialStatusColoringMaxWork = Math.max(initialStatusColoringMaxWork, totalWork);

        if (initialStatusColoringMaxWork > 0) {
          const rawProgress =
            ((initialStatusColoringMaxWork - totalWork) / initialStatusColoringMaxWork) * 100;
          initialStatusColoringProgress = Math.min(99, Math.max(0, Math.round(rawProgress)));
        }

        return;
      }

      if (initialStatusColoringSeenWork && !initialTokenizeLoading) {
        initialStatusColoringProgress = 100;
        initialStatusColoringLoading = false;
        initialStatusColoringCompleted = true;
        stopInitialStatusColoringMonitor();
      }
    }, 120);
  }

  async function runWarmCacheWithProgress(service: BookContentColoring): Promise<{
    totalCards: number;
    cachedWords: number;
    duration: number;
  }> {
    warmCacheLoading = true;
    warmCacheProgress = {
      phase: 'fetch-cards',
      percentage: 0,
      completed: 0,
      total: 1,
      detail: 'Starting cache refresh'
    };

    try {
      const stats = await service.warmCache({
        onProgress: (progress) => {
          warmCacheProgress = progress;
        }
      });
      warmCacheProgress = {
        phase: 'process-words',
        percentage: 100,
        completed: warmCacheProgress?.completed ?? 1,
        total: warmCacheProgress?.total ?? 1,
        detail: 'Cache refresh complete'
      };
      return stats;
    } finally {
      warmCacheLoading = false;
    }
  }

  function invalidateTokenPanelForCacheRefresh(): void {
    tokenPanelCacheVersion++;
    tokenPanelResult = undefined;
    tokenPanelError = '';
  }

  async function runPostWarmCacheRefresh(service: BookContentColoring): Promise<void> {
    console.log('🔄 Re-colorizing with updated cache...');
    await service.recolorizeProcessedElements();
    console.log('✅ Re-colorization complete');

    invalidateTokenPanelForCacheRefresh();
    if (showTokenPanel) {
      console.log('🔄 Re-running token panel analysis with refreshed cache...');
      void analyzeForTokenPanel();
    }
  }

  async function runWarmCacheRefreshFlow(service: BookContentColoring): Promise<void> {
    if (cacheRefreshPromise) {
      await cacheRefreshPromise;
      return;
    }

    cacheRefreshPromise = (async () => {
      try {
        const stats = await runWarmCacheWithProgress(service);
        console.log(
          `✅ Cache refreshed: ${stats.cachedWords} words from ${stats.totalCards} cards in ${stats.duration}ms`
        );
        await runPostWarmCacheRefresh(service);
        tokenPanelWordDataPrimed = true;
      } catch (err) {
        console.error('❌ Failed to refresh cache:', err);
      } finally {
        cacheRefreshPromise = null;
      }
    })();

    await cacheRefreshPromise;
  }

  async function applyServiceSettingAndRefresh(
    apply: (service: BookContentColoring) => Promise<void> | void
  ): Promise<void> {
    const service = coloringService;
    if (!service) {
      return;
    }

    await apply(service);
    await runWarmCacheRefreshFlow(service);
  }

  async function waitForRefreshPrerequisites(): Promise<void> {
    if (cacheLoadingPromise) {
      await cacheLoadingPromise;
    }

    if (cacheRefreshPromise) {
      await cacheRefreshPromise;
    }

    if (initialTokenizePromise) {
      await initialTokenizePromise;
    }
  }

  async function ensureTokenPanelWordDataPrimed(service: BookContentColoring): Promise<void> {
    if (tokenPanelWordDataPrimed) {
      return;
    }

    if (!tokenPanelWordDataPrimingPromise) {
      tokenPanelWordDataPrimingPromise = (async () => {
        await runWarmCacheRefreshFlow(service);
        if (!tokenPanelWordDataPrimed) {
          throw new Error('Word data priming did not complete');
        }
      })().finally(() => {
        tokenPanelWordDataPrimingPromise = null;
      });
    }

    await tokenPanelWordDataPrimingPromise;
  }

  function isTokenPanelFilter(value: string): value is TokenPanelFilterId {
    return (
      value === 'all' ||
      value === 'due' ||
      value === 'uncollected' ||
      value === 'new' ||
      value === 'young' ||
      value === 'mature' ||
      value === 'unknown'
    );
  }

  function isTokenPanelOrthographyFilter(value: string): value is TokenPanelOrthographyFilterId {
    return value === 'all-scripts' || value === 'has-kanji';
  }

  function isTokenPanelSort(value: string): value is TokenPanelSortId {
    return value === 'frequency' || value === 'book-order';
  }

  if (typeof window !== 'undefined') {
    const savedFilter = window.localStorage.getItem(tokenPanelFilterStorageKey);
    if (savedFilter && isTokenPanelFilter(savedFilter)) {
      tokenPanelActiveFilter = savedFilter;
    }

    const savedOrthographyFilter = window.localStorage.getItem(
      tokenPanelOrthographyFilterStorageKey
    );
    if (savedOrthographyFilter && isTokenPanelOrthographyFilter(savedOrthographyFilter)) {
      tokenPanelActiveOrthographyFilter = savedOrthographyFilter;
    }

    const savedSort = window.localStorage.getItem(tokenPanelSortStorageKey);
    if (savedSort && isTokenPanelSort(savedSort)) {
      tokenPanelActiveSort = savedSort;
    }
  }

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
  let cacheRefreshPromise: Promise<void> | null = null;

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
          colorMode: $ankiColorMode$,
          desiredRetention: $ankiDesiredRetention$ / 100,
          matureThreshold: $ankiMatureThreshold$,
          tokenStyle: $ankiTokenStyle$,
          colorPalette: $ankiColorPalette$
        },
        ankiCacheService
      );
      tokenPanelWordDataPrimed = false;
      tokenPanelWordDataPrimingPromise = null;

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

        if (cacheInfo.loadedWords > 0) {
          console.log(
            `⚡ IndexedDB cache ready (${cacheInfo.loadedWords} words, age: ${Math.round(cacheInfo.cacheAge / 60000)} min) - queries will use IndexedDB on-demand`
          );
        } else {
          console.log('⚠️ No IndexedDB word cache rows found yet');
        }

        // Step 2: Start colorization immediately
        // IndexedDB queries happen on-demand, no need to wait for preloading
        if (!coloringQueue && service) {
          console.log(`🎨 Starting colorization with IndexedDB as primary cache...`);
          // maxConcurrent: 1 batch at a time (avoid Anki freezing)
          // batchSize: 5 elements per batch (smaller batches, faster feedback)
          // Tokens are chunked to 10 per Anki query for retrievability checks
          coloringQueue = new ColoringPriorityQueue(service, 1, 5);
          startInitialStatusColoringMonitor();
        }

        // Step 3: Refresh cache in background (don't block colorization)
        if (cacheInfo.needsRefresh) {
          console.log('🔄 Refreshing cache from Anki in background...');
          void runWarmCacheRefreshFlow(service);
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
    initialTokenizeAbortController?.abort();
    initialTokenizePromise = null;
    initialTokenizeLoading = false;
    initialTokenizeProgress = undefined;
    initialTokenizeActiveKey = '';
    stopInitialStatusColoringMonitor();
    resetInitialStatusColoringState();
    warmCacheLoading = false;
    warmCacheProgress = undefined;
    cacheLoadingPromise = null;
    cacheRefreshPromise = null;
    tokenPanelWordDataPrimed = false;
    tokenPanelWordDataPrimingPromise = null;

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
    previousAnkiColorMode = undefined;
    previousAnkiColorPalette = undefined;
    previousAnkiDesiredRetention = undefined;
    previousAnkiMatureThreshold = undefined;
  }

  $: if ($ankiIntegrationEnabled$ && coloringService) {
    const currentMode = $ankiColorMode$;
    if (previousAnkiColorMode !== undefined && previousAnkiColorMode !== currentMode) {
      void (async () => {
        await applyServiceSettingAndRefresh((service) => service.setColorMode(currentMode));
      })();
    }
    previousAnkiColorMode = currentMode;
  }

  $: if ($ankiIntegrationEnabled$ && coloringService) {
    const currentPalette = $ankiColorPalette$;
    if (previousAnkiColorPalette !== undefined && previousAnkiColorPalette !== currentPalette) {
      coloringService.setColorPalette(currentPalette);
      void coloringService.recolorizeProcessedElements();
    }
    previousAnkiColorPalette = currentPalette;
  }

  $: if ($ankiIntegrationEnabled$ && coloringService) {
    const currentDesiredRetention = $ankiDesiredRetention$ / 100;
    if (
      previousAnkiDesiredRetention !== undefined &&
      previousAnkiDesiredRetention !== currentDesiredRetention
    ) {
      void (async () => {
        await applyServiceSettingAndRefresh((service) =>
          service.setDesiredRetention(currentDesiredRetention)
        );
      })();
    }

    previousAnkiDesiredRetention = currentDesiredRetention;
  }

  $: if ($ankiIntegrationEnabled$ && coloringService) {
    const currentMatureThreshold = $ankiMatureThreshold$;
    if (
      previousAnkiMatureThreshold !== undefined &&
      previousAnkiMatureThreshold !== currentMatureThreshold
    ) {
      void (async () => {
        await applyServiceSettingAndRefresh((service) =>
          service.setMatureThreshold(currentMatureThreshold)
        );
      })();
    }
    previousAnkiMatureThreshold = currentMatureThreshold;
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
    tokenPanelAnalysisAbortController?.abort();
    initialTokenizeAbortController?.abort();
    initialTokenizePromise = null;
    initialTokenizeActiveKey = '';
    stopInitialStatusColoringMonitor();
    warmCacheLoading = false;
    warmCacheProgress = undefined;
    mutationObserver.disconnect();
    if (typeof window !== 'undefined' && tokenPanelBookmarkShiftRaf !== undefined) {
      window.cancelAnimationFrame(tokenPanelBookmarkShiftRaf);
      tokenPanelBookmarkShiftRaf = undefined;
    }
    if (tokenPanelBookmarkShiftTimeout) {
      clearTimeout(tokenPanelBookmarkShiftTimeout);
      tokenPanelBookmarkShiftTimeout = undefined;
    }

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

  function extractDocumentText(html: string): string {
    if (typeof document === 'undefined' || !html) {
      return '';
    }

    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('rt, rp, script, style').forEach((node) => node.remove());
    container.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    container
      .querySelectorAll('p, div, section, article, li, tr, h1, h2, h3, h4, h5, h6')
      .forEach((node) => {
        node.append(document.createTextNode('\n'));
      });

    return container.textContent?.replace(/\n{3,}/g, '\n\n').trim() || '';
  }

  const bookCharacterRegex =
    /[0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]/iu;

  function mapExploredCharCountToTextOffset(text: string, exploredCount: number): number {
    if (!text || exploredCount <= 0) {
      return 0;
    }

    let currentCount = 0;
    let offset = 0;

    for (const character of Array.from(text)) {
      offset += character.length;

      if (!bookCharacterRegex.test(character)) {
        continue;
      }

      currentCount += 1;
      if (currentCount >= exploredCount) {
        return offset;
      }
    }

    return text.length;
  }

  function getDocumentSentenceSourceKey(): string {
    const prefix = htmlContent.slice(0, 256);
    const suffix = htmlContent.slice(-256);
    return [htmlContent.length, prefix, suffix].join('::');
  }

  function normalizeSentenceSearchText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  function splitIntoSentences(text: string): string[] {
    const sentencePattern = /[^。！？!?]+[。！？!?]+[」』）】〕］〉》〗〙〛"'”’]*|[^。！？!?]+$/g;
    const normalizedLines = text
      .replace(/\r/g, '\n')
      .split(/\n+/g)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const sentences: string[] = [];

    for (const line of normalizedLines) {
      const matches = line.match(sentencePattern);
      if (!matches) {
        sentences.push(line);
        continue;
      }

      for (const match of matches) {
        const sentence = match.trim();
        if (sentence.length > 0) {
          sentences.push(sentence);
        }
      }
    }

    return sentences;
  }

  function getDocumentSentences(): string[] {
    const sourceKey = getDocumentSentenceSourceKey();
    if (tokenPanelSentenceSourceKey !== sourceKey) {
      tokenPanelSentenceSourceKey = sourceKey;
      tokenPanelSentenceMatches = {};
      tokenPanelDocumentSentences = splitIntoSentences(extractDocumentText(htmlContent));
    }

    return tokenPanelDocumentSentences;
  }

  function findSentencesForToken(token: string, limit = 5): string[] {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return [];
    }

    return getDocumentSentences()
      .filter((sentence) => sentence.includes(normalizedToken))
      .slice(0, limit);
  }

  function resolveSentencePageNumber(target: HTMLElement): number | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (viewMode === ViewMode.Continuous) {
      const absoluteOffset = verticalMode
        ? target.getBoundingClientRect().left + window.scrollX
        : target.getBoundingClientRect().top + window.scrollY;
      const viewportSize = verticalMode ? window.innerWidth : window.innerHeight;
      const margin = Math.max(0, firstDimensionMargin || 0) * 2;
      const pageSize = Math.max(1, viewportSize - margin);

      return Math.max(1, Math.floor(absoluteOffset / pageSize) + 1);
    }

    const scrollContainer = target.closest('.book-content') as HTMLElement | null;
    if (!scrollContainer) {
      return null;
    }

    const targetRect = target.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const horizontalOverflow = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const verticalOverflow = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const isHorizontalFlow = horizontalOverflow >= verticalOverflow;

    if (isHorizontalFlow) {
      const offset = targetRect.left - containerRect.left + scrollContainer.scrollLeft;
      const pageSize = Math.max(1, scrollContainer.clientWidth);
      return Math.max(1, Math.floor(offset / pageSize) + 1);
    }

    const offset = targetRect.top - containerRect.top + scrollContainer.scrollTop;
    const pageSize = Math.max(1, scrollContainer.clientHeight);
    return Math.max(1, Math.floor(offset / pageSize) + 1);
  }

  function findSentenceMatchesForToken(token: string, limit = 5): TokenPanelSentenceMatch[] {
    return findSentencesForToken(token, limit).map((sentence) => {
      const target = findReaderTargetForSentence(token, sentence);
      const page = target ? resolveSentencePageNumber(target) : null;
      return { sentence, page };
    });
  }

  interface ReaderFlashState {
    previousBackground: string;
    previousOutline: string;
    previousTransition: string;
    timeoutId?: ReturnType<typeof setTimeout>;
  }

  const readerFlashStateByTarget = new WeakMap<HTMLElement, ReaderFlashState>();

  function flashReaderTarget(target: HTMLElement, durationMs = 1700): void {
    let flashState = readerFlashStateByTarget.get(target);
    if (!flashState) {
      flashState = {
        previousBackground: target.style.backgroundColor,
        previousOutline: target.style.outline,
        previousTransition: target.style.transition
      };
      readerFlashStateByTarget.set(target, flashState);
    }

    if (flashState.timeoutId) {
      clearTimeout(flashState.timeoutId);
    }

    target.style.transition = 'background-color 180ms ease, outline-color 180ms ease';
    target.style.backgroundColor = 'rgba(34, 211, 238, 0.20)';
    target.style.outline = '2px solid rgba(34, 211, 238, 0.55)';

    flashState.timeoutId = setTimeout(() => {
      const latestState = readerFlashStateByTarget.get(target);
      if (!latestState) {
        return;
      }

      target.style.backgroundColor = latestState.previousBackground;
      target.style.outline = latestState.previousOutline;
      target.style.transition = latestState.previousTransition;
      readerFlashStateByTarget.delete(target);
    }, durationMs);
  }

  function findSentenceLineHost(target: HTMLElement): HTMLElement {
    return (target.closest('p,li,section,article,div,td') as HTMLElement | null) || target;
  }

  function findTokenTargetsInSentenceHost(sentenceHost: HTMLElement, token: string): HTMLElement[] {
    const tokenTargets = Array.from(
      sentenceHost.querySelectorAll<HTMLElement>('[data-anki-token]')
    ).filter((element) => element.getAttribute('data-anki-token') === token);

    if (sentenceHost.getAttribute('data-anki-token') === token) {
      tokenTargets.unshift(sentenceHost);
    }

    return Array.from(new Set(tokenTargets));
  }

  async function waitForScrollToSettle(target: HTMLElement, timeoutMs = 1600): Promise<void> {
    const start = performance.now();
    let stableFrames = 0;
    let previousTop = target.getBoundingClientRect().top;

    await new Promise<void>((resolve) => {
      const tick = () => {
        const now = performance.now();
        const currentTop = target.getBoundingClientRect().top;
        const delta = Math.abs(currentTop - previousTop);
        previousTop = currentTop;

        if (delta < 0.5) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }

        if (stableFrames >= 6 || now - start >= timeoutMs) {
          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }

  function findReaderTargetForSentence(token: string, sentence: string): HTMLElement | null {
    const container = $containerEl$;
    if (!container) {
      return null;
    }

    const normalizedSentence = normalizeSentenceSearchText(sentence);
    const sentenceSnippet = normalizedSentence.slice(0, Math.min(40, normalizedSentence.length));

    const tokenSpans = Array.from(
      container.querySelectorAll<HTMLElement>('[data-anki-token]')
    ).filter((span) => span.getAttribute('data-anki-token') === token);

    for (const span of tokenSpans) {
      const contextHost =
        (span.closest('p,li,section,article,div,td') as HTMLElement | null) || span;
      const contextText = normalizeSentenceSearchText(contextHost.textContent || '');

      if (!sentenceSnippet || contextText.includes(sentenceSnippet)) {
        return span;
      }
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeText = normalizeSentenceSearchText(node.textContent || '');
      if (sentenceSnippet && nodeText.includes(sentenceSnippet)) {
        return (node.parentElement as HTMLElement | null) || null;
      }
    }

    return tokenSpans[0] || null;
  }

  async function scrollToSentence(token: string, sentence: string): Promise<void> {
    const target = findReaderTargetForSentence(token, sentence);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    await waitForScrollToSettle(target);

    const sentenceLineHost = findSentenceLineHost(target);
    flashReaderTarget(sentenceLineHost, 1200);

    const tokenTargets = findTokenTargetsInSentenceHost(sentenceLineHost, token);
    const targetsToFlash = tokenTargets.length > 0 ? tokenTargets : [target];

    window.setTimeout(() => {
      for (const tokenTarget of targetsToFlash) {
        flashReaderTarget(tokenTarget, 1200);
      }
    }, 240);
  }

  async function activateTokenPanelToken(
    token: string,
    options: { toggleIfActive: boolean } = { toggleIfActive: true }
  ): Promise<void> {
    if (options.toggleIfActive && tokenPanelActiveToken === token) {
      tokenPanelActiveToken = null;
      tokenPanelSentenceLoadingToken = null;
      return;
    }

    if (!options.toggleIfActive && tokenPanelActiveToken === token) {
      tokenPanelActiveToken = null;
      await tick();
    }

    tokenPanelActiveToken = token;
    getDocumentSentences();

    if (tokenPanelSentenceMatches[token]) {
      return;
    }

    tokenPanelSentenceLoadingToken = token;
    await Promise.resolve();

    try {
      const matches = findSentenceMatchesForToken(token, 5);
      tokenPanelSentenceMatches = { ...tokenPanelSentenceMatches, [token]: matches };
    } finally {
      if (tokenPanelSentenceLoadingToken === token) {
        tokenPanelSentenceLoadingToken = null;
      }
    }
  }

  async function onTokenPanelTokenSelect(event: CustomEvent<{ token: string }>): Promise<void> {
    await activateTokenPanelToken(event.detail.token, { toggleIfActive: true });
  }

  function getTokenFromElement(element: Element | null | undefined): string | null {
    if (!element) {
      return null;
    }

    const tokenElement =
      (element.closest('[data-anki-token]') as HTMLElement | null) ||
      (element instanceof HTMLElement ? element : null);
    const token = tokenElement?.getAttribute('data-anki-token')?.trim();
    if (!token || !tokenPanelJumpHasLetterRegex.test(token)) {
      return null;
    }

    return token;
  }

  function entryMatchesActivePanelFilters(entry: DocumentTokenAnalysisEntry): boolean {
    if (tokenPanelActiveFilter === 'due') {
      if (!entry.due) {
        return false;
      }
    } else if (tokenPanelActiveFilter !== 'all' && entry.status !== tokenPanelActiveFilter) {
      return false;
    }

    if (
      tokenPanelActiveOrthographyFilter === 'has-kanji' &&
      !tokenPanelJumpHasKanjiRegex.test(entry.token)
    ) {
      return false;
    }

    return true;
  }

  function getTokenElementsInDocumentOrder(): HTMLElement[] {
    const container = $containerEl$;
    if (!container) {
      return [];
    }

    return Array.from(container.querySelectorAll<HTMLElement>('[data-anki-token]'));
  }

  function getTokenElementIndexNearCurrentPosition(tokenElements: HTMLElement[]): number {
    if (typeof window === 'undefined' || tokenElements.length === 0) {
      return 0;
    }

    const anchorX = verticalMode
      ? Math.max(0, Math.min(window.innerWidth - 1, window.innerWidth - firstDimensionMargin - 6))
      : Math.max(0, Math.min(window.innerWidth - 1, window.innerWidth / 2));
    const anchorY = verticalMode
      ? Math.max(0, Math.min(window.innerHeight - 1, window.innerHeight / 2))
      : Math.max(0, Math.min(window.innerHeight - 1, firstDimensionMargin + 6));
    let nearestIndex = 0;
    let nearestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < tokenElements.length; index += 1) {
      const element = tokenElements[index];
      const rect = element.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        continue;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const score = Math.abs(centerX - anchorX) + Math.abs(centerY - anchorY);
      if (score < nearestScore) {
        nearestScore = score;
        nearestIndex = index;
      }
    }

    return nearestIndex;
  }

  function getFilteredTokenEntriesInBookOrder(): DocumentTokenAnalysisEntry[] {
    if (!tokenPanelResult) {
      return [];
    }

    return [...tokenPanelResult.entries]
      .filter((entry) => entryMatchesActivePanelFilters(entry))
      .sort(
        (a, b) =>
          a.firstOccurrence - b.firstOccurrence ||
          b.count - a.count ||
          a.token.localeCompare(b.token, 'ja')
      );
  }

  function findNextFilteredTokenFromCurrentPosition(): string | null {
    const filteredEntries = getFilteredTokenEntriesInBookOrder();
    if (filteredEntries.length === 0) {
      return null;
    }

    const tokensByBookOrder = getTokenElementsInDocumentOrder();
    if (tokensByBookOrder.length === 0) {
      return filteredEntries[0].token;
    }

    const filteredTokenSet = new Set(filteredEntries.map((entry) => entry.token));
    const startIndex = getTokenElementIndexNearCurrentPosition(tokensByBookOrder);

    for (let i = startIndex; i < tokensByBookOrder.length; i += 1) {
      const token = getTokenFromElement(tokensByBookOrder[i]);
      if (token && filteredTokenSet.has(token)) {
        return token;
      }
    }

    for (let i = 0; i < startIndex; i += 1) {
      const token = getTokenFromElement(tokensByBookOrder[i]);
      if (token && filteredTokenSet.has(token)) {
        return token;
      }
    }

    return filteredEntries[0].token;
  }

  async function resolveNextFilteredTokenWithRetry(
    options: { preferDifferentFrom?: string | null; attempts?: number; delayMs?: number } = {}
  ): Promise<string | null> {
    const preferDifferentFrom = options.preferDifferentFrom ?? null;
    const attempts = Math.max(1, options.attempts ?? 5);
    const delayMs = Math.max(0, options.delayMs ?? 80);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const token = findNextFilteredTokenFromCurrentPosition();
      if (token && (!preferDifferentFrom || token !== preferDifferentFrom)) {
        return token;
      }

      if (attempt < attempts - 1) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, delayMs);
        });
      }
    }

    return findNextFilteredTokenFromCurrentPosition();
  }

  async function onTokenPanelJumpToCurrentLocation(): Promise<void> {
    const token = await resolveNextFilteredTokenWithRetry({
      preferDifferentFrom: tokenPanelActiveToken
    });
    if (!token) {
      tokenPanelActiveToken = null;
      tokenPanelSentenceLoadingToken = null;
      return;
    }

    if (tokenPanelActiveSort !== 'book-order') {
      tokenPanelActiveSort = 'book-order';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(tokenPanelSortStorageKey, tokenPanelActiveSort);
      }
    }

    await activateTokenPanelToken(token, { toggleIfActive: false });
  }

  function onTokenPanelSentenceSelect(
    event: CustomEvent<{ token: string; sentence: string }>
  ): void {
    const { token, sentence } = event.detail;
    void scrollToSentence(token, sentence);
  }

  function openRepositionDialog(): void {
    repositionDialogOpen = true;
    repositionError = '';
    repositionSummary = undefined;
  }

  function closeRepositionDialog(): void {
    if (repositionLoading) {
      return;
    }
    repositionDialogOpen = false;
  }

  function clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(100, Math.max(0, value));
  }

  function normalizePositiveInt(value: number, fallback = 1): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(1, Math.trunc(value));
  }

  function resolveRepositionRange(
    mode: RepositionRangeMode,
    fullTextLength: number,
    anchoredTextLength: number
  ): { maxTokens: number | undefined; maxChars: number | undefined } {
    let maxTokens: number | undefined;
    let maxChars: number | undefined;

    if (mode === 'tokens') {
      maxTokens = normalizePositiveInt(repositionTokenLimit);
    } else if (mode === 'chars') {
      maxChars = normalizePositiveInt(repositionCharLimit);
    } else if (mode === 'percent') {
      const percentage = clampPercent(repositionCharPercent);
      maxChars = normalizePositiveInt((fullTextLength * percentage) / 100);
    }

    if (typeof maxChars === 'number') {
      maxChars = Math.min(maxChars, anchoredTextLength);
    }

    return { maxTokens, maxChars };
  }

  async function runRepositionNewCards(): Promise<void> {
    const service = coloringService;
    if (!service) {
      repositionError = 'Anki service is not ready.';
      return;
    }
    if (!$ankiIntegrationEnabled$) {
      repositionError = 'Enable Anki integration first.';
      return;
    }

    const fullText = extractDocumentText(htmlContent);
    if (!fullText.trim()) {
      repositionError = 'Could not extract readable text from this book.';
      return;
    }

    const startOffset =
      repositionStartMode === 'bookmark'
        ? mapExploredCharCountToTextOffset(
            fullText,
            Math.max(0, Math.trunc(exploredCharCount || 0))
          )
        : 0;
    const textFromAnchor = fullText.slice(startOffset);
    if (!textFromAnchor.trim()) {
      repositionError = 'No text remaining from the selected start point.';
      return;
    }

    const { maxTokens, maxChars } = resolveRepositionRange(
      repositionRangeMode,
      fullText.length,
      textFromAnchor.length
    );
    const minOccurrences = normalizePositiveInt(repositionMinOccurrences);

    repositionLoading = true;
    repositionError = '';
    repositionSummary = undefined;

    try {
      const order = await service.buildRepositionOrderForNewCards(textFromAnchor, {
        maxTokens,
        maxChars,
        chunkSize: 2500,
        scanLength: 2500,
        orderMode: repositionOrderMode,
        minOccurrences
      });

      if (order.orderedCardIds.length === 0) {
        repositionError = 'No candidate cards were found in the selected range.';
        return;
      }

      const result = await service.repositionNewCardsByOrder(order.orderedCardIds, {
        startPosition: normalizePositiveInt(repositionStartPosition),
        step: normalizePositiveInt(repositionStep),
        shift: repositionShift
      });

      repositionSummary = {
        requested: result.requested,
        deduped: result.deduped,
        eligibleNew: result.eligibleNew,
        repositioned: result.repositioned,
        skippedNotFound: result.skippedNotFound,
        skippedNotNew: result.skippedNotNew,
        processedTokens: order.processedTokens,
        uniqueTokens: order.uniqueTokens,
        processedChars: order.processedChars,
        startOffset,
        effectiveMaxChars: maxChars ?? textFromAnchor.length,
        effectiveMaxTokens: maxTokens ?? null,
        orderMode: repositionOrderMode,
        minOccurrences
      };
    } catch (error) {
      repositionError = error instanceof Error ? error.message : `${error}`;
    } finally {
      repositionLoading = false;
    }
  }

  function onTokenPanelFilterChange(event: CustomEvent<{ filter: TokenPanelFilterId }>): void {
    tokenPanelActiveFilter = event.detail.filter;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(tokenPanelFilterStorageKey, tokenPanelActiveFilter);
    }
  }

  function onTokenPanelOrthographyFilterChange(
    event: CustomEvent<{ filter: TokenPanelOrthographyFilterId }>
  ): void {
    tokenPanelActiveOrthographyFilter = event.detail.filter;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        tokenPanelOrthographyFilterStorageKey,
        tokenPanelActiveOrthographyFilter
      );
    }
  }

  function onTokenPanelSortChange(event: CustomEvent<{ sort: TokenPanelSortId }>): void {
    tokenPanelActiveSort = event.detail.sort;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(tokenPanelSortStorageKey, tokenPanelActiveSort);
    }
  }

  async function onTokenPanelRefreshStatuses(): Promise<void> {
    const service = coloringService;
    if (!service || !$ankiIntegrationEnabled$) {
      return;
    }

    // Keep this action bulk-only: disable per-token hover refreshes while full refresh runs.
    tokenPanelHoverRefreshSuppressedUntilMs = Date.now() + 15_000;

    try {
      await runWarmCacheRefreshFlow(service);
    } finally {
      tokenPanelHoverRefreshSuppressedUntilMs = Date.now() + 5_000;
    }
  }

  async function onTokenPanelTokenHover(event: CustomEvent<{ token: string }>): Promise<void> {
    const token = event.detail.token;
    const service = coloringService;

    if (
      !service ||
      !tokenPanelResult ||
      tokenPanelLoading ||
      warmCacheLoading ||
      !!cacheRefreshPromise ||
      Date.now() < tokenPanelHoverRefreshSuppressedUntilMs
    ) {
      return;
    }

    const now = Date.now();
    const lastRefreshAt = tokenPanelLastHoverRefresh.get(token) || 0;
    if (now - lastRefreshAt < tokenPanelHoverRefreshCooldownMs) {
      return;
    }
    tokenPanelLastHoverRefresh.set(token, now);

    try {
      const refreshed = await service.refreshTokenAnalysisFromAnki(token);

      if (!tokenPanelResult) {
        return;
      }

      let hasMatch = false;
      const updatedEntries = tokenPanelResult.entries.map((entry) => {
        if (entry.token !== token) {
          return entry;
        }

        hasMatch = true;
        return {
          ...entry,
          status: refreshed.status,
          due: refreshed.due,
          cardIds: refreshed.cardIds
        };
      });

      if (!hasMatch) {
        return;
      }

      tokenPanelResult = {
        ...tokenPanelResult,
        entries: updatedEntries
      };
    } catch (error) {
      console.debug(`Token panel hover refresh failed for "${token}"`, error);
    }
  }

  function getTokenPanelAnalysisKey(): string {
    const prefix = htmlContent.slice(0, 256);
    const suffix = htmlContent.slice(-256);
    return [
      htmlContent.length,
      prefix,
      suffix,
      $ankiColorMode$,
      $ankiDesiredRetention$,
      $ankiMatureThreshold$,
      $ankiWordDeckNames$.join('|'),
      $ankiWordFields$.join('|'),
      tokenPanelCacheVersion
    ].join('::');
  }

  function getTokenPanelTokenCountCacheKey(fullText: string): string {
    const prefix = fullText.slice(0, 256);
    const suffix = fullText.slice(-256);
    return ['token-count-v2', fullText.length, prefix, suffix].join('::');
  }

  function getInitialTokenizeKey(fullText: string): string {
    const prefix = fullText.slice(0, 256);
    const suffix = fullText.slice(-256);
    return ['tokenize-bootstrap-v1', fullText.length, prefix, suffix].join('::');
  }

  const lemmaCoverageSampleSize = 200;
  const minimumLemmaCoverage = 0.9;

  async function ensureInitialTokenizeBootstrap(): Promise<void> {
    const service = coloringService;
    if (!service || !$ankiIntegrationEnabled$) {
      return;
    }

    const fullText = extractDocumentText(htmlContent);
    const trimmedText = fullText.trim();
    if (!trimmedText) {
      initialTokenizeLoading = false;
      initialTokenizeProgress = undefined;
      return;
    }

    const initialTokenizeKey = getInitialTokenizeKey(trimmedText);
    if (initialTokenizeCompletedKeys.has(initialTokenizeKey)) {
      return;
    }

    const tokenizeChunkSize = 2500;
    const tokenCountCacheKey = getTokenPanelTokenCountCacheKey(trimmedText);
    const cachedTokenCounts = await ankiCacheService.getDocumentTokenCounts(tokenCountCacheKey);
    if (cachedTokenCounts && cachedTokenCounts.entries.length > 0) {
      const sampleTokens = Array.from(
        new Set(
          cachedTokenCounts.entries
            .map((entry) => entry.token.trim())
            .filter(Boolean)
            .slice(0, lemmaCoverageSampleSize)
        )
      );
      const cachedLemmas =
        sampleTokens.length > 0 ? await ankiCacheService.getLemmasBatch(sampleTokens) : new Map();
      const lemmaCoverage =
        sampleTokens.length === 0 ? 1 : cachedLemmas.size / Math.max(1, sampleTokens.length);

      if (lemmaCoverage >= minimumLemmaCoverage) {
        initialTokenizeCompletedKeys.add(initialTokenizeKey);
        initialTokenizeLoading = false;
        initialTokenizeProgress = undefined;
        return;
      }

      console.log(
        `⚠️ Lemma coverage is low (${Math.round(lemmaCoverage * 100)}%), rebuilding token index cache...`
      );
    }

    if (initialTokenizeLoading) {
      if (initialTokenizeActiveKey === initialTokenizeKey) {
        return;
      }

      initialTokenizeAbortController?.abort();
    }

    const abortController = new AbortController();
    initialTokenizeAbortController = abortController;
    initialTokenizeActiveKey = initialTokenizeKey;
    initialTokenizeLoading = true;
    initialTokenizeProgress = {
      completedSteps: 0,
      totalSteps: 0,
      percentage: 0
    };

    const promise = (async () => {
      await service.preTokenizeDocument(trimmedText, {
        signal: abortController.signal,
        onProgress: (progress) => {
          initialTokenizeProgress = progress;
        },
        chunkSize: tokenizeChunkSize,
        scanLength: tokenizeChunkSize,
        tokenCountCacheKey
      });
      initialTokenizeCompletedKeys.add(initialTokenizeKey);
    })();

    initialTokenizePromise = promise;

    try {
      await promise;
      if (!abortController.signal.aborted) {
        await service.recolorizeProcessedElements();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('Initial tokenization bootstrap failed:', error);
    } finally {
      if (initialTokenizeAbortController === abortController) {
        initialTokenizeLoading = false;
        initialTokenizeAbortController = undefined;
        initialTokenizeActiveKey = '';
      }

      if (initialTokenizePromise === promise) {
        initialTokenizePromise = null;
      }
    }
  }

  async function analyzeForTokenPanel(): Promise<void> {
    const service = coloringService;
    if (!service || !showTokenPanel || !$ankiIntegrationEnabled$) {
      return;
    }

    const nextKey = getTokenPanelAnalysisKey();
    if (tokenPanelResult && tokenPanelAnalysisKey === nextKey && !tokenPanelError) {
      return;
    }

    tokenPanelAnalysisAbortController?.abort();
    const abortController = new AbortController();
    tokenPanelAnalysisAbortController = abortController;
    tokenPanelAnalysisKey = nextKey;
    tokenPanelLoading = true;
    tokenPanelProgress = undefined;
    tokenPanelError = '';

    try {
      await waitForRefreshPrerequisites();
      await ensureTokenPanelWordDataPrimed(service);

      const analysisChunkSize = 2500;
      const fullText = extractDocumentText(htmlContent);
      const tokenCountCacheKey = getTokenPanelTokenCountCacheKey(fullText);
      tokenPanelResult = await service.analyzeDocumentText(fullText, {
        signal: abortController.signal,
        onProgress: (progress) => {
          tokenPanelProgress = progress;
        },
        chunkSize: analysisChunkSize,
        batchSize: 250,
        scanLength: analysisChunkSize,
        tokenCountCacheKey
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('Token panel analysis failed:', error);
      tokenPanelResult = undefined;
      tokenPanelError = error instanceof Error ? error.message : `${error}`;
    } finally {
      if (tokenPanelAnalysisAbortController === abortController) {
        tokenPanelLoading = false;
      }
    }
  }

  $: if (!showTokenPanel) {
    tokenPanelAnalysisAbortController?.abort();
    tokenPanelLoading = false;
    tokenPanelProgress = undefined;
    tokenPanelActiveToken = null;
    tokenPanelSentenceLoadingToken = null;
    tokenPanelLastHoverRefresh.clear();
  }

  $: {
    $containerEl$;
    showTokenPanel;
    width;
    height;
    htmlContent;
    scheduleTokenPanelBookmarkShiftUpdate();
  }

  $: {
    const nextDocKey = getColoringDocKey(htmlContent);
    if (nextDocKey !== initialStatusColoringDocKey) {
      initialStatusColoringDocKey = nextDocKey;
      stopInitialStatusColoringMonitor();
      resetInitialStatusColoringState();

      if ($ankiIntegrationEnabled$ && coloringQueue) {
        startInitialStatusColoringMonitor();
      }
    }
  }

  $: if ($ankiIntegrationEnabled$ && coloringService && htmlContent) {
    void ensureInitialTokenizeBootstrap();
  }

  $: if (showTokenPanel && coloringService && $ankiIntegrationEnabled$) {
    void analyzeForTokenPanel();
  }

  $: readerPreparationLoading =
    initialTokenizeLoading || warmCacheLoading || initialStatusColoringLoading;

  $: readerPreparationLabel = initialTokenizeLoading
    ? 'Preparing token index'
    : warmCacheLoading
      ? 'Syncing Anki cache'
      : 'Applying token colors';

  $: readerPreparationPercentage = initialTokenizeLoading
    ? (initialTokenizeProgress?.percentage ?? 0)
    : warmCacheLoading
      ? (warmCacheProgress?.percentage ?? 0)
      : initialStatusColoringProgress;

  $: readerPreparationDetail = initialTokenizeLoading
    ? `Step ${initialTokenizeProgress?.completedSteps ?? 0} / ${initialTokenizeProgress?.totalSteps ?? 0}`
    : warmCacheLoading
      ? (warmCacheProgress?.detail ?? 'Refreshing Anki cache')
      : `Queue ${initialStatusColoringQueueTotal}`;

  function scheduleTokenPanelBookmarkShiftUpdate() {
    if (typeof window === 'undefined') return;

    if (tokenPanelBookmarkShiftRaf !== undefined) {
      window.cancelAnimationFrame(tokenPanelBookmarkShiftRaf);
    }

    tokenPanelBookmarkShiftRaf = window.requestAnimationFrame(() => {
      tokenPanelBookmarkShiftRaf = undefined;
      updateTokenPanelBookmarkShift();
    });

    if (tokenPanelBookmarkShiftTimeout) {
      clearTimeout(tokenPanelBookmarkShiftTimeout);
    }
    tokenPanelBookmarkShiftTimeout = window.setTimeout(() => {
      tokenPanelBookmarkShiftTimeout = undefined;
      updateTokenPanelBookmarkShift();
    }, 220);
  }

  function updateTokenPanelBookmarkShift() {
    if (typeof window === 'undefined') return;

    const container = $containerEl$;
    if (!container) {
      tokenPanelBookmarkShift = 0;
      return;
    }

    const anchor =
      container.querySelector<HTMLElement>('[data-anki-token]') ??
      container.querySelector<HTMLElement>('.book-content');
    if (!anchor) {
      tokenPanelBookmarkShift = 0;
      return;
    }

    const currentAnchorLeft = anchor.getBoundingClientRect().left;

    if (!showTokenPanel || window.innerWidth < 1024) {
      tokenPanelBaseAnchorLeft = currentAnchorLeft;
      tokenPanelBookmarkShift = 0;
      return;
    }

    // If panel was opened before baseline was captured, best-effort estimate baseline.
    if (tokenPanelBaseAnchorLeft === undefined) {
      const tokenPanelMaxWidthPx = convertRemToPixels(24);
      const tokenPanelMinViewportPaddingPx = convertRemToPixels(2);
      const tokenPanelGapPx = convertRemToPixels(1.5);
      const fallbackPanelOffset = Math.max(
        Math.min(tokenPanelMaxWidthPx, window.innerWidth - tokenPanelMinViewportPaddingPx) +
          tokenPanelGapPx,
        0
      );
      tokenPanelBaseAnchorLeft = currentAnchorLeft + fallbackPanelOffset / 2;
    }

    tokenPanelBookmarkShift = currentAnchorLeft - tokenPanelBaseAnchorLeft;
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
{#if readerPreparationLoading}
  <div
    class="fixed left-1/2 top-12 z-[25] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-cyan-400/30 bg-slate-950/90 px-3 py-2 shadow-xl backdrop-blur"
    style:writing-mode="horizontal-tb"
  >
    <div class="mb-1 flex items-center justify-between text-xs text-cyan-100">
      <span>{readerPreparationLabel}</span>
      <span>{readerPreparationPercentage}%</span>
    </div>
    <div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div
        class="h-full bg-cyan-400 transition-all duration-150"
        style={`width: ${readerPreparationPercentage}%`}
      />
    </div>
    <div class="mt-1 text-[11px] text-slate-300">{readerPreparationDetail}</div>
  </div>
{/if}
<div
  bind:this={$containerEl$}
  class="{pxReader} reader-shell py-8"
  class:token-panel-open={showTokenPanel}
  style:--token-panel-bookmark-shift={`${tokenPanelBookmarkShift}px`}
>
  {#if viewMode === ViewMode.Continuous}
    <BookReaderContinuous
      {htmlContent}
      width={$contentViewportWidth$ ?? 0}
      height={$contentViewportHeight$ ?? 0}
      {verticalMode}
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
{#if showTokenPanel}
  <BookReaderTokenPanel
    loading={tokenPanelLoading}
    progress={tokenPanelProgress}
    entries={tokenPanelResult?.entries || []}
    totalTokens={tokenPanelResult?.totalTokens || 0}
    uniqueTokens={tokenPanelResult?.uniqueTokens || 0}
    error={tokenPanelError}
    refreshing={warmCacheLoading}
    activeFilter={tokenPanelActiveFilter}
    activeOrthographyFilter={tokenPanelActiveOrthographyFilter}
    activeSort={tokenPanelActiveSort}
    activeToken={tokenPanelActiveToken}
    tokenSentences={tokenPanelSentenceMatches}
    sentenceLoadingToken={tokenPanelSentenceLoadingToken}
    on:close={() => dispatch('tokenPanelClose')}
    on:refreshStatuses={onTokenPanelRefreshStatuses}
    on:repositionNewCards={openRepositionDialog}
    on:filterChange={onTokenPanelFilterChange}
    on:orthographyFilterChange={onTokenPanelOrthographyFilterChange}
    on:sortChange={onTokenPanelSortChange}
    on:jumpToCurrentLocation={onTokenPanelJumpToCurrentLocation}
    on:tokenSelect={onTokenPanelTokenSelect}
    on:tokenHover={onTokenPanelTokenHover}
    on:sentenceSelect={onTokenPanelSentenceSelect}
  />
{/if}
{#if repositionDialogOpen}
  <div
    class="fixed inset-0 z-30 bg-black/50"
    style:writing-mode="'horizontal-tb'"
    on:click={closeRepositionDialog}
  />
  <div
    class="fixed left-1/2 top-1/2 z-[31] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-600 bg-slate-950 p-4 text-slate-100 shadow-2xl"
    style:writing-mode="'horizontal-tb'"
    on:click|stopPropagation
  >
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">Reposition New Cards</h3>
      <button
        class="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-400"
        on:click={closeRepositionDialog}
        disabled={repositionLoading}
      >
        Close
      </button>
    </div>

    <div class="space-y-4 text-sm">
      <div>
        <div class="mb-1 text-xs uppercase tracking-wide text-slate-400">Start From</div>
        <div class="flex flex-wrap gap-3">
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-start"
              value="bookmark"
              bind:group={repositionStartMode}
            />
            <span>Current bookmark</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-start"
              value="start"
              bind:group={repositionStartMode}
            />
            <span>Start of book</span>
          </label>
        </div>
      </div>

      <div>
        <div class="mb-1 text-xs uppercase tracking-wide text-slate-400">Range</div>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-range"
              value="to-end"
              bind:group={repositionRangeMode}
            />
            <span>Until end of book</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-range"
              value="tokens"
              bind:group={repositionRangeMode}
            />
            <span>First N tokens</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-range"
              value="chars"
              bind:group={repositionRangeMode}
            />
            <span>First N chars</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-range"
              value="percent"
              bind:group={repositionRangeMode}
            />
            <span>First % of full-book chars</span>
          </label>
        </div>
      </div>

      <div>
        <div class="mb-1 text-xs uppercase tracking-wide text-slate-400">Ordering</div>
        <div class="flex flex-wrap gap-3">
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-order"
              value="book-order"
              bind:group={repositionOrderMode}
            />
            <span>Book order</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reposition-order"
              value="occurrences"
              bind:group={repositionOrderMode}
            />
            <span>Occurrences</span>
          </label>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <label
          class="w-36 text-xs uppercase tracking-wide text-slate-400"
          for="reposition-min-occurrences"
        >
          Min occurrences
        </label>
        <input
          id="reposition-min-occurrences"
          class="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
          type="number"
          min="1"
          step="1"
          bind:value={repositionMinOccurrences}
        />
      </div>

      {#if repositionRangeMode === 'tokens'}
        <div class="flex items-center gap-3">
          <label
            class="w-36 text-xs uppercase tracking-wide text-slate-400"
            for="reposition-token-limit"
          >
            Token limit
          </label>
          <input
            id="reposition-token-limit"
            class="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            type="number"
            min="1"
            step="1"
            bind:value={repositionTokenLimit}
          />
        </div>
      {/if}

      {#if repositionRangeMode === 'chars'}
        <div class="flex items-center gap-3">
          <label
            class="w-36 text-xs uppercase tracking-wide text-slate-400"
            for="reposition-char-limit"
          >
            Char limit
          </label>
          <input
            id="reposition-char-limit"
            class="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            type="number"
            min="1"
            step="1"
            bind:value={repositionCharLimit}
          />
        </div>
      {/if}

      {#if repositionRangeMode === 'percent'}
        <div class="flex items-center gap-3">
          <label
            class="w-36 text-xs uppercase tracking-wide text-slate-400"
            for="reposition-char-percent"
          >
            Char percent
          </label>
          <input
            id="reposition-char-percent"
            class="w-32 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            type="number"
            min="0"
            max="100"
            step="1"
            bind:value={repositionCharPercent}
          />
          <span class="text-xs text-slate-400">%</span>
        </div>
      {/if}

      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div class="flex items-center gap-3">
          <label
            class="w-28 text-xs uppercase tracking-wide text-slate-400"
            for="reposition-start-position"
          >
            Start position
          </label>
          <input
            id="reposition-start-position"
            class="w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            type="number"
            min="1"
            step="1"
            bind:value={repositionStartPosition}
          />
        </div>
        <div class="flex items-center gap-3">
          <label class="w-28 text-xs uppercase tracking-wide text-slate-400" for="reposition-step">
            Step
          </label>
          <input
            id="reposition-step"
            class="w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            type="number"
            min="1"
            step="1"
            bind:value={repositionStep}
          />
        </div>
      </div>

      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={repositionShift} />
        <span>Shift existing cards to preserve untouched order</span>
      </label>

      {#if repositionError}
        <div class="rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {repositionError}
        </div>
      {/if}

      {#if repositionSummary}
        <div
          class="rounded border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100"
        >
          <div>Requested: {repositionSummary.requested}</div>
          <div>Deduped: {repositionSummary.deduped}</div>
          <div>Eligible new: {repositionSummary.eligibleNew}</div>
          <div>Repositioned: {repositionSummary.repositioned}</div>
          <div>
            Processed text: {repositionSummary.processedChars} chars, {repositionSummary.processedTokens}
            tokens ({repositionSummary.uniqueTokens} unique)
          </div>
          <div>Start offset: {repositionSummary.startOffset} chars</div>
          <div>Effective max chars: {repositionSummary.effectiveMaxChars}</div>
          <div>
            Order mode: {repositionSummary.orderMode === 'book-order'
              ? 'Book order'
              : 'Occurrences'}
          </div>
          <div>Min occurrences: {repositionSummary.minOccurrences}</div>
          {#if repositionSummary.effectiveMaxTokens !== null}
            <div>Effective max tokens: {repositionSummary.effectiveMaxTokens}</div>
          {/if}
          {#if repositionSummary.skippedNotFound.length > 0}
            <div>Skipped not found: {repositionSummary.skippedNotFound.length}</div>
          {/if}
          {#if repositionSummary.skippedNotNew.length > 0}
            <div>Skipped not new: {repositionSummary.skippedNotNew.length}</div>
          {/if}
        </div>
      {/if}

      <div class="flex justify-end">
        <button
          class="rounded border border-cyan-500/60 bg-cyan-500/15 px-3 py-1 text-sm text-cyan-100 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          on:click={runRepositionNewCards}
          disabled={repositionLoading}
        >
          {#if repositionLoading}
            Repositioning...
          {:else}
            Reposition New Cards
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
{$blurListener$ ?? ''}
{$reactiveElements$ ?? ''}
<svelte:document bind:visibilityState />

<style>
  .reader-shell {
    --token-panel-offset: 0px;
    --token-panel-bookmark-shift: 0px;
    transition: padding-right 180ms ease;
  }

  @media (min-width: 1024px) {
    .reader-shell.token-panel-open {
      padding-right: calc(min(24rem, 100vw - 2rem) + 1.5rem);
      --token-panel-offset: calc(min(24rem, 100vw - 2rem) + 1.5rem);
    }

    .reader-shell.token-panel-open :global(.bookmark-indicator) {
      transform: translateX(var(--token-panel-bookmark-shift));
    }
  }
</style>
