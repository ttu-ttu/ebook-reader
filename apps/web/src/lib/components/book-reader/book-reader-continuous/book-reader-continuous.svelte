<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { Subject } from 'rxjs';
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
  export let loadingState: boolean;
  export let multiplier: number;
  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  const destroy$ = new Subject<void>();

  onDestroy(() => {
    destroy$.next();
    destroy$.complete();
  });

  let exploredCharCount = 0;
  let bookCharCount = 0;

  const dispatch = createEventDispatcher<{
    contentChange: HTMLElement;
    contentReady: void;
    exploredCharCountChange: number;
    bookCharCountChange: number;
  }>();

  let contentEl: HTMLElement | undefined;

  let calculator: CharacterStatsCalculator | undefined;
  let htmlLoadEvent: Event | undefined;
  let contentReadyEvent = {};
  let dispatchedContentReady = false;
  $: {
    if (contentEl && htmlLoadEvent) {
      dispatchedContentReady = false;
      calculator = new CharacterStatsCalculator(
        contentEl,
        verticalMode,
        document.documentElement,
        document
      );
      exploredCharCount = 0;
      bookCharCount = calculator.charCount;
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

  function onContentDisplayChange(_calculator: CharacterStatsCalculator) {
    _calculator.updateParagraphPos();
    exploredCharCount = _calculator.calcExploredCharCount();

    if (!dispatchedContentReady) {
      dispatch('contentReady');
      dispatchedContentReady = true;
    }
    contentReadyEvent = {};
  }

  $: dispatch('exploredCharCountChange', exploredCharCount);
  $: dispatch('bookCharCountChange', bookCharCount);

  const scrollFn = browser
    ? horizontalMouseWheel(4, document.documentElement, requestAnimationFrame)
    : () => 0;

  function onWheel(ev: WheelEvent) {
    if (verticalMode) {
      scrollFn(ev, fontSize, window.innerWidth);
    }
  }

  function onScroll() {
    requestAnimationFrame(() => {
      if (!calculator) return;

      exploredCharCount = calculator.calcExploredCharCount();
    });
  }

  function onHtmlLoad(ev: Event) {
    if (!contentEl) return;

    dispatch('contentChange', contentEl);
    htmlLoadEvent = ev;
  }

  $: fullLengthDimension = verticalMode ? 'height' : 'width';
  $: modifyingDimension = verticalMode ? 'width' : 'height';
  $: boundSide = verticalMode ? (['left', 'right'] as const) : (['top', 'bottom'] as const);

  export let autoScroller: AutoScroller | undefined;
  let autoScrollerConcrete: AutoScrollerContinuous | undefined;
  if (browser) {
    autoScrollerConcrete = new AutoScrollerContinuous(multiplier, verticalMode, destroy$, document);
    autoScroller = autoScrollerConcrete;
  }
  $: {
    if (autoScrollerConcrete) {
      autoScrollerConcrete.multiplier = multiplier;
      autoScrollerConcrete.verticalMode = verticalMode;
    }
  }

  export let bookmarkManager: BookmarkManager | undefined;
  let bookmarkManagerConcrete: BookmarkManagerContinuous | undefined;
  $: {
    if (browser && calculator) {
      bookmarkManagerConcrete =
        browser && calculator && new BookmarkManagerContinuous(calculator, window);
      bookmarkManager = bookmarkManagerConcrete;
    }
  }

  let bookmarkPos: BookmarkPosData | undefined;
  $: {
    if (contentReadyEvent) {
      bookmarkPos = undefined;
      bookmarkData.then((data) => {
        if (!data) return;
        bookmarkPos = bookmarkManagerConcrete?.getBookmarkBarPosition(data);
      });
    }
  }

  export let pageManager: PageManager | undefined;
  $: {
    if (browser) {
      pageManager = new PageManagerContinuous(verticalMode, firstDimensionMargin, window);
    }
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
    > :global(*) {
      margin-left: 6rem;
    }

    :global(img) {
      max-height: var(--book-content-child-height, 100%);
    }
  }
</style>
