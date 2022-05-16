<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import {
    animationFrameScheduler,
    combineLatest,
    debounce,
    debounceTime,
    distinctUntilChanged,
    EMPTY,
    filter,
    fromEvent,
    map,
    observeOn,
    skip,
    Subject,
    switchMap,
    take,
    takeUntil,
    timer
  } from 'rxjs';
  import { browser } from '$app/env';
  import {
    nextChapter$,
    sectionList$,
    sectionProgress$,
    tocIsOpen$,
    type SectionWithProgress
  } from '$lib/components/book-toc/book-toc';
  import { prependValue } from '$lib/functions/file-loaders/epub/generate-epub-html';
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

  export let autoBookmark: boolean;

  export let loadingState: boolean;

  export let multiplier: number;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let autoScroller: AutoScroller | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let pageManager: PageManager | undefined;

  const dispatch = createEventDispatcher<{
    bookmark: void;
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

  const sectionToElement: Map<string, HTMLElement> = new Map();

  const sectionData: Map<string, SectionWithProgress> = new Map();

  let scrollAdjustment = 0;

  let willNavigate = false;

  $: fullLengthDimension = verticalMode ? 'height' : 'width';

  $: modifyingDimension = verticalMode ? 'width' : 'height';

  $: boundSide = verticalMode ? (['left', 'right'] as const) : (['top', 'bottom'] as const);

  $: width$.next(width);

  $: height$.next(height);

  $: maxHeight = verticalMode && secondDimensionMaxValue ? secondDimensionMaxValue : undefined;

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
        browser &&
        calculator &&
        new BookmarkManagerContinuous(calculator, window, firstDimensionMargin || 0);
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

      bookmarkData
        .then((data) => {
          if (!data || !bookmarkManager) {
            return;
          }
          bookmarkManager.scrollToBookmark(data);
        })
        .finally(() => {
          if (autoBookmark) {
            fromEvent(window, 'scroll')
              .pipe(skip(1), debounceTime(3000), takeUntil(destroy$))
              .subscribe(() => {
                dispatch('bookmark');
              });
          }

          sectionList$
            .pipe(
              take(1),
              switchMap((sections) => {
                if (!sections.length) {
                  return EMPTY;
                }

                sections.forEach((section) => {
                  const ref = section.reference;
                  const elm = document.getElementById(ref);

                  if (elm) {
                    if (!scrollAdjustment) {
                      scrollAdjustment =
                        Number(
                          getComputedStyle(elm)[
                            verticalMode ? 'marginLeft' : 'marginBottom'
                          ].replace(/px$/, '')
                        ) / 2;
                    }

                    sectionData.set(ref, { ...section, progress: 0 });
                    sectionToElement.set(ref, elm);
                  }
                });

                if (sectionToElement.size) {
                  updateSectionProgress();

                  return fromEvent(window, 'scroll');
                }
                return EMPTY;
              }),
              debounce(() => timer(willNavigate ? 100 : 500)),
              takeUntil(destroy$)
            )
            .subscribe(updateSectionProgress);
        });
    }
    contentReadyEvent = {};
  }

  function updateSectionProgress() {
    const entries = [...sectionData.entries()];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const [ref, entry] = entries[index];

      const elm = sectionToElement.get(ref) as HTMLElement;
      const rect = elm.getBoundingClientRect();

      entry.progress = verticalMode
        ? (Math.min(
            Math.max(rect.right + (firstDimensionMargin || 0) - window.innerWidth, 0),
            rect.width
          ) /
            (rect.width || 1)) *
          100
        : (Math.abs(Math.min(Math.max(rect.top - (firstDimensionMargin || 0), -rect.height), 0)) /
            (rect.height || 1)) *
          100;

      sectionData.set(ref, entry);
    }

    willNavigate = false;
    sectionProgress$.next(sectionData);
  }

  function onWheel(ev: WheelEvent) {
    if (verticalMode && !$tocIsOpen$) {
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

  nextChapter$.pipe(takeUntil(destroy$)).subscribe((chapterId) => {
    let targetElement = document.getElementById(chapterId);

    if (!targetElement) {
      return;
    }

    const checkForParent = !chapterId.startsWith(prependValue);

    targetElement = checkForParent
      ? targetElement.closest(`div[id^="${prependValue}"]`) || targetElement
      : targetElement;

    willNavigate = true;

    const rect = targetElement.getBoundingClientRect();

    if (verticalMode) {
      window.scrollBy(
        -(window.innerWidth - rect.right - (firstDimensionMargin || 0) - scrollAdjustment),
        0
      );
    } else {
      window.scrollBy(0, rect.top - (firstDimensionMargin || 0) - scrollAdjustment);
    }
  });
</script>

<div
  bind:this={contentEl}
  style:color={fontColor}
  style:font-size="{fontSize}px"
  style:max-width={!verticalMode && secondDimensionMaxValue
    ? `${secondDimensionMaxValue}px`
    : undefined}
  style:max-height={maxHeight ? `${maxHeight}px` : undefined}
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
  style:--book-content-child-height="{maxHeight || height}px"
  class:book-content--writing-vertical-rl={verticalMode}
  class:book-content--writing-horizontal-rl={!verticalMode}
  class:book-content--hide-furigana={hideFurigana}
  class:book-content--hide-spoiler-image={hideSpoilerImage}
  class:book-content--furigana-style-partial={furiganaStyle === FuriganaStyle.Partial}
  class:book-content--furigana-style-full={furiganaStyle === FuriganaStyle.Full}
  class:book-content--furigana-style-toggle={furiganaStyle === FuriganaStyle.Toggle}
  class="book-content m-auto"
>
  <HtmlRenderer html={htmlContent} on:load={onHtmlLoad} />
</div>

{#if firstDimensionMargin}
  <div
    class="fixed z-[5]"
    style:background-color={backgroundColor}
    style="{fullLengthDimension}: 100%; {modifyingDimension}: {firstDimensionMargin}px; {boundSide[0]}: 0"
  />
  <div
    class="fixed z-[5]"
    style:background-color={backgroundColor}
    style="{fullLengthDimension}: 100%; {modifyingDimension}: {firstDimensionMargin}px; {boundSide[1]}: 0"
  />
{/if}

{#if bookmarkPos}
  {#if verticalMode}
    <div
      style:height={`${maxHeight || height}px`}
      style:right={bookmarkPos.right}
      class="pointer-events-none absolute inset-y-0 m-auto w-12 bg-yellow-600 bg-opacity-10"
    />
  {:else}
    <div
      style:width={`${secondDimensionMaxValue || width}px`}
      style:top={bookmarkPos.top}
      class="absolute inset-x-0 h-12 bg-yellow-600 bg-opacity-10 pointer-events-none m-auto"
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
