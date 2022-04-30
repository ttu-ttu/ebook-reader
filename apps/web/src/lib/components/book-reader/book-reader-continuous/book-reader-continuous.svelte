<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import {
    animationFrameScheduler,
    combineLatest,
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    observeOn,
    skip,
    Subject,
    takeUntil
  } from 'rxjs';
  import { browser } from '$app/env';
  import HtmlRenderer from '$lib/components/html-renderer.svelte';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import type { AutoScroller, BookmarkManager, PageManager } from '../types';
  import { BookmarkManagerContinuous, type BookmarkPosData } from './bookmark-manager-continuous';
  import { CharacterStatsCalculator } from './character-stats-calculator';
  import { horizontalMouseWheel } from './horizontal-mouse-wheel';
  import { PageManagerContinuous } from './page-manager-continuous';
  import { AutoScrollerContinuous } from './auto-scroller-continuous';

  export let htmlContent: string;

  export let width: number;

  export let height: number;

  export let verticalMode: boolean;

  export let fontColor: string;

  export let backgroundColor: string;

  export let hintFuriganaFontColor: string;

  export let hintFuriganaShadowColor: string;

  export let fontSize: number;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let hideSpoilerImage: boolean;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let autoPositionOnResize: boolean;

  export let loadingState: boolean;

  export let multiplier: number;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let autoScroller: AutoScroller | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let pageManager: PageManager | undefined;

  const dispatch = createEventDispatcher<{
    contentChange: HTMLElement;
  }>();

  let contentEl: HTMLElement | undefined;

  let calculator: CharacterStatsCalculator | undefined;

  let contentReadyEvent = {};

  let autoScrollerConcrete: AutoScrollerContinuous | undefined;

  let bookmarkManagerConcrete: BookmarkManagerContinuous | undefined;

  let pageManagerConcrete: PageManagerContinuous | undefined;

  let bookmarkPos: BookmarkPosData | undefined;

  let scrollWhenReady: boolean;

  let prevIntendedCharCount = 0;

  let isResizeScroll = false;

  const scrollFn = browser
    ? horizontalMouseWheel(4, document.documentElement, requestAnimationFrame)
    : () => 0;

  const width$ = new Subject<number>();

  const height$ = new Subject<number>();

  const destroy$ = new Subject<void>();

  $: fullLengthDimension = verticalMode ? 'height' : 'width';

  $: modifyingDimension = verticalMode ? 'width' : 'height';

  $: boundSide = verticalMode ? (['left', 'right'] as const) : (['top', 'bottom'] as const);

  $: width$.next(width);

  $: height$.next(height);

  $: {
    if (htmlContent) {
      scrollWhenReady = true;
    }
  }

  $: {
    if (calculator && width && height && !loadingState) {
      const c = calculator;
      requestAnimationFrame(() => {
        onContentDisplayChange(c);
      });
    }
  }

  $: {
    if (autoScrollerConcrete) {
      autoScrollerConcrete.multiplier = multiplier;
      autoScrollerConcrete.verticalMode = verticalMode;
    }
  }

  $: {
    if (browser && calculator) {
      bookmarkManagerConcrete =
        browser && calculator && new BookmarkManagerContinuous(calculator, window);
      bookmarkManager = bookmarkManagerConcrete;
    }
  }

  $: {
    if (contentReadyEvent) {
      bookmarkPos = undefined;
      bookmarkData.then((data) => {
        if (!data) return;
        bookmarkPos = bookmarkManagerConcrete?.getBookmarkBarPosition(data);
      });
    }
  }

  $: {
    if (browser) {
      pageManagerConcrete = new PageManagerContinuous(verticalMode, firstDimensionMargin, window);
      pageManager = pageManagerConcrete;
    }
  }

  onDestroy(() => {
    destroy$.next();
    destroy$.complete();
  });

  if (browser) {
    autoScrollerConcrete = new AutoScrollerContinuous(multiplier, verticalMode, destroy$, document);
    autoScroller = autoScrollerConcrete;
  }

  combineLatest([width$, height$])
    .pipe(
      filter(() => autoPositionOnResize),
      skip(1),
      map(([w, h]) => (verticalMode ? h : w)),
      distinctUntilChanged(),
      debounceTime(10),
      observeOn(animationFrameScheduler),
      takeUntil(destroy$)
    )
    .subscribe(() => {
      if (!calculator || !pageManagerConcrete) return;

      const scrollPos = calculator.getScrollPosByCharCount(prevIntendedCharCount);
      isResizeScroll = true;
      pageManagerConcrete.scrollTo(scrollPos);
    });

  function onContentDisplayChange(_calculator: CharacterStatsCalculator) {
    _calculator.updateParagraphPos();
    exploredCharCount = _calculator.calcExploredCharCount();

    if (scrollWhenReady) {
      scrollWhenReady = false;
      bookmarkData.then((data) => {
        if (!data || !bookmarkManager) return;
        bookmarkManager.scrollToBookmark(data);
      });
    }
    contentReadyEvent = {};
  }

  function onWheel(ev: WheelEvent) {
    if (verticalMode) {
      scrollFn(ev, fontSize, window.innerWidth);
    }
  }

  function onScroll() {
    requestAnimationFrame(() => {
      if (!calculator) return;

      exploredCharCount = calculator.calcExploredCharCount();
      if (!isResizeScroll) {
        prevIntendedCharCount = exploredCharCount;
      }
      isResizeScroll = false;
    });
  }

  function onHtmlLoad() {
    if (!contentEl) return;

    calculator = new CharacterStatsCalculator(
      contentEl,
      verticalMode ? 'vertical' : 'horizontal',
      verticalMode ? 'rtl' : 'ltr',
      document.documentElement,
      document
    );
    exploredCharCount = 0;
    prevIntendedCharCount = exploredCharCount;
    bookCharCount = calculator.charCount;
    dispatch('contentChange', contentEl);
  }
</script>

<div
  bind:this={contentEl}
  style:color={fontColor}
  style:font-size="{fontSize}px"
  style:max-width={!verticalMode && secondDimensionMaxValue
    ? `${secondDimensionMaxValue}px`
    : undefined}
  style:max-height={verticalMode && secondDimensionMaxValue
    ? `${secondDimensionMaxValue}px`
    : undefined}
  style:padding-left={verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:padding-right={verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:padding-top={!verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:padding-bottom={!verticalMode && firstDimensionMargin
    ? `${firstDimensionMargin}px`
    : undefined}
  style:--font-family-serif={fontFamilyGroupOne}
  style:--font-family-sans-serif={fontFamilyGroupTwo}
  style:--book-content-hint-furigana-font-color={hintFuriganaFontColor}
  style:--book-content-hint-furigana-shadow-color={hintFuriganaShadowColor}
  style:--book-content-child-height="{height}px"
  class:book-content--writing-vertical-rl={verticalMode}
  class:book-content--writing-horizontal-rl={!verticalMode}
  class:book-content--hide-furigana={hideFurigana}
  class:book-content--hide-spoiler-image={hideSpoilerImage}
  class:book-content--furigana-style-partial={furiganaStyle === FuriganaStyle.Partial}
  class:book-content--furigana-style-full={furiganaStyle === FuriganaStyle.Full}
  class="book-content m-auto"
>
  <HtmlRenderer html={htmlContent} on:load={onHtmlLoad} />
</div>

{#if firstDimensionMargin}
  <div
    class="fixed"
    style:background-color={backgroundColor}
    style="{fullLengthDimension}: 100%; {modifyingDimension}: {firstDimensionMargin}px; {boundSide[0]}: 0"
  />
  <div
    class="fixed"
    style:background-color={backgroundColor}
    style="{fullLengthDimension}: 100%; {modifyingDimension}: {firstDimensionMargin}px; {boundSide[1]}: 0"
  />
{/if}

{#if bookmarkPos}
  {#if verticalMode}
    <div
      style:right={bookmarkPos.right}
      class="pointer-events-none absolute inset-y-0 w-12 bg-yellow-600 bg-opacity-10"
    />
  {:else}
    <div
      style:top={bookmarkPos.top}
      class="absolute inset-x-0 h-12 bg-yellow-600 bg-opacity-10 pointer-events-none"
    />
  {/if}
{/if}

<svelte:body on:wheel|nonpassive={onWheel} />
<svelte:window on:scroll={onScroll} />

<style lang="scss">
  @import '../styles';

  .book-content {
    :global(svg),
    :global(img) {
      max-height: 100vh;
    }
  }

  .book-content--writing-vertical-rl {
    height: 100%;
    > :global(*) {
      margin-left: 6rem;
    }

    :global(img) {
      max-height: var(--book-content-child-height, 100%);
    }
  }

  .book-content--writing-horizontal-rl {
    > :global(*) {
      margin-bottom: 6rem;
    }

    :global(.grouped-image) {
      display: flex;
      flex-direction: row-reverse;
      justify-content: center;

      :global(svg) {
        margin: 0;
      }
    }
  }
</style>
