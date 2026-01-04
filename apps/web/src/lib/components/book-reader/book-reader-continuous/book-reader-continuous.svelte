<script lang="ts">
  import { browser } from '$app/environment';
  import {
    nextChapter$,
    sectionList$,
    sectionProgress$,
    type SectionWithProgress
  } from '$lib/components/book-reader/book-toc/book-toc';
  import HtmlRenderer from '$lib/components/html-renderer.svelte';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import { isStoredFont } from '$lib/data/fonts';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import { logger } from '$lib/data/logger';
  import {
    customReadingPointEnabled$,
    disableWheelNavigation$,
    skipKeyDownListener$,
    userFonts$
  } from '$lib/data/store';
  import { prependValue } from '$lib/functions/file-loaders/epub/generate-epub-html';
  import { getReferencePoints } from '$lib/functions/range-util';
  import { getExternalTargetElement } from '$lib/functions/utils';
  import { faBookmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
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
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import type { AutoScroller, BookmarkManager, PageManager } from '../types';
  import { AutoScrollerContinuous } from './auto-scroller-continuous';
  import { BookmarkManagerContinuous, type BookmarkPosData } from './bookmark-manager-continuous';
  import { CharacterStatsCalculator } from './character-stats-calculator';
  import { horizontalMouseWheel } from './horizontal-mouse-wheel';
  import { PageManagerContinuous } from './page-manager-continuous';

  export let htmlContent: string;

  export let width: number;

  export let height: number;

  export let verticalMode: boolean;

  export let fontFeatureSettings: string;

  export let verticalTextOrientation: string;

  export let prioritizeReaderStyles: boolean;

  export let enableTextJustification: boolean;

  export let enableTextWrapPretty: boolean;

  export let fontColor: string;

  export let backgroundColor: string;

  export let hintFuriganaFontColor: string;

  export let hintFuriganaShadowColor: string;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let fontSize: number;

  export let lineHeight: number;

  export let textIndentation: number;

  export let textMarginValue: number;

  export let hideSpoilerImage: boolean;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let autoPositionOnResize: boolean;

  export let autoBookmark: boolean;

  export let autoBookmarkTime: number;

  export let loadingState: boolean;

  export let multiplier: number;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let autoScroller: AutoScroller | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let pageManager: PageManager | undefined;

  export let customReadingPoint: number;

  export let customReadingPointLeft: number;

  export let customReadingPointTop: number;

  export let customReadingPointScrollOffset: number;

  const dispatch = createEventDispatcher<{
    bookmark: void;
    contentChange: HTMLElement;
    trackerPause: void;
  }>();

  let allowDisplay = false;

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

  let bookmarkAdjustment = window.matchMedia('(min-width: 640px)').matches ? '0.5rem' : '0.25rem';

  let fontLoadingAdded = false;

  const scrollFn = browser
    ? horizontalMouseWheel(4, document.documentElement, requestAnimationFrame)
    : () => 0;

  const width$ = new Subject<number>();

  const height$ = new Subject<number>();

  const destroy$ = new Subject<void>();

  const sectionToElement = new Map<string, HTMLElement>();

  const sectionData = new Map<string, SectionWithProgress>();

  let scrollAdjustment = 0;

  let willNavigate = false;

  $: fullLengthDimension = verticalMode ? 'height' : 'width';

  $: modifyingDimension = verticalMode ? 'width' : 'height';

  $: boundSide = verticalMode ? (['left', 'right'] as const) : (['top', 'bottom'] as const);

  $: width$.next(width);

  $: height$.next(height);

  $: maxHeight = verticalMode && secondDimensionMaxValue ? secondDimensionMaxValue : undefined;

  $: if (secondDimensionMaxValue && contentEl) {
    const dimensionAdjustment = Number(
      getComputedStyle(contentEl)[verticalMode ? 'marginTop' : 'marginRight'].replace(/px$/, '')
    );

    bookmarkAdjustment = `min(max(calc(${`${dimensionAdjustment}px - ${bookmarkAdjustment}`}), ${bookmarkAdjustment}), ${
      dimensionAdjustment ? `${dimensionAdjustment}px` : bookmarkAdjustment
    })`;
  }

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

  $: if ($customReadingPointEnabled$ && contentEl && Number.isFinite(customReadingPoint)) {
    updateCustomReadingPointPosition();
    onScroll();
    updateSectionProgress();
  }

  /** Experimental Code - May be removed any time without warning */
  onMount(() => document.addEventListener('ttu-action', handleAction, false));

  function handleAction({ detail }: any) {
    if (!detail.type) {
      return;
    }

    if (detail.type === 'cue') {
      const { scroll, rect } = needScroll(detail.selector, detail.scrollMode);

      if (!scroll) {
        return;
      }

      willNavigate = true;

      if (verticalMode) {
        window.scrollBy({
          left: -(
            window.innerWidth -
            rect.right -
            (firstDimensionMargin || 0) -
            customReadingPointScrollOffset -
            (!customReadingPointScrollOffset ||
            (customReadingPointScrollOffset && scrollAdjustment > customReadingPointScrollOffset)
              ? scrollAdjustment
              : 0)
          ),
          top: 0,
          behavior: detail.scrollBehavior || 'instant'
        });
      } else {
        window.scrollBy({
          left: 0,
          top:
            rect.top -
            (firstDimensionMargin || 0) -
            customReadingPointScrollOffset -
            (!customReadingPointScrollOffset ||
            (customReadingPointScrollOffset && scrollAdjustment > customReadingPointScrollOffset)
              ? scrollAdjustment
              : 0),
          behavior: detail.scrollBehavior || 'instant'
        });
      }
    } else if (
      detail.type === 'pauseTracker' &&
      needScroll(detail.selector, detail.scrollMode).scroll
    ) {
      dispatch('trackerPause');
    }
  }

  function needScroll(selector: string, scrollMode: string) {
    const targetElement = getExternalTargetElement(document, selector, !verticalMode);

    if (!targetElement || !contentEl) {
      return { scroll: false, rect: { top: 0, right: 0, bottom: 0, left: 0 } };
    }

    const rect = targetElement.getBoundingClientRect();

    if (!scrollMode || scrollMode === 'Always') {
      return { scroll: true, rect };
    }

    const footerElement = verticalMode ? null : document.getElementById('ttu-page-footer');
    const {
      elTopReferencePoint,
      elLeftReferencePoint,
      elBottomReferencePoint,
      elRightReferencePoint
    } = getReferencePoints(
      window,
      contentEl,
      verticalMode,
      firstDimensionMargin,
      !verticalMode && footerElement
        ? Number.parseFloat(getComputedStyle(footerElement).height.replace('px', ''))
        : 0
    );

    if (verticalMode) {
      return {
        scroll: rect.left <= elLeftReferencePoint || rect.right >= elRightReferencePoint,
        rect
      };
    }

    return {
      scroll: rect.top <= elTopReferencePoint || rect.bottom >= elBottomReferencePoint,
      rect
    };
  }
  /** Experimental Code - May be removed any time without warning */

  onDestroy(() => {
    document.removeEventListener('ttu-action', handleAction, false);

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

      const scrollPos =
        calculator.getScrollPosByCharCount(prevIntendedCharCount) +
        (verticalMode ? customReadingPointScrollOffset : -customReadingPointScrollOffset);
      isResizeScroll = true;
      pageManagerConcrete.scrollTo(scrollPos);
    });

  function updateCustomReadingPointPosition() {
    if (!$customReadingPointEnabled$ || !contentEl) {
      return;
    }

    const {
      elLeftReferencePoint,
      elTopReferencePoint,
      elRightReferencePoint,
      elBottomReferencePoint,
      firstDimensionMargin: firstDimensionMarginValue,
      pointGap
    } = getReferencePoints(window, contentEl, verticalMode, firstDimensionMargin);

    if (verticalMode) {
      customReadingPointTop = elTopReferencePoint;
      customReadingPointLeft = Math.min(
        Math.max(
          firstDimensionMarginValue +
            (elRightReferencePoint - elLeftReferencePoint) * (customReadingPoint / 100) -
            2,
          elLeftReferencePoint + pointGap
        ),
        elRightReferencePoint - 2
      );
      customReadingPointScrollOffset =
        window.innerWidth - firstDimensionMarginValue - customReadingPointLeft;

      return;
    }

    customReadingPointTop = Math.min(
      Math.max(
        firstDimensionMarginValue +
          (elBottomReferencePoint - elTopReferencePoint) * (customReadingPoint / 100),
        firstDimensionMarginValue
      ),
      elBottomReferencePoint - pointGap * 1.5
    );
    customReadingPointLeft = elLeftReferencePoint;
    customReadingPointScrollOffset = customReadingPointTop - firstDimensionMarginValue;
  }

  function onContentDisplayChange(_calculator: CharacterStatsCalculator) {
    _calculator.updateParagraphPos();
    updateCustomReadingPointPosition();
    exploredCharCount = _calculator.calcExploredCharCount(customReadingPointScrollOffset);

    if (scrollWhenReady) {
      scrollWhenReady = false;

      bookmarkData
        .then((data) => {
          if (!data || !bookmarkManager) {
            return;
          }

          prevIntendedCharCount = data.exploredCharCount || 0;
          bookmarkManager.scrollToBookmark(data, customReadingPointScrollOffset);
        })
        .finally(() => {
          if (autoBookmark) {
            fromEvent(window, 'scroll')
              .pipe(skip(1), debounceTime(autoBookmarkTime * 1000), takeUntil(destroy$))
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
    allowDisplay = true;
  }

  function updateSectionProgress() {
    const entries = [...sectionData.entries()];

    for (let index = 0, { length } = entries; index < length; index += 1) {
      const [ref, entry] = entries[index];

      const elm = sectionToElement.get(ref) as HTMLElement;
      const rect = elm.getBoundingClientRect();

      entry.progress = verticalMode
        ? (Math.min(
            Math.max(
              rect.right +
                (firstDimensionMargin || 0) -
                window.innerWidth +
                customReadingPointScrollOffset,
              0
            ),
            rect.width
          ) /
            (rect.width || 1)) *
          100
        : (Math.abs(
            Math.min(
              Math.max(
                rect.top - (firstDimensionMargin || 0) - customReadingPointScrollOffset,
                -rect.height
              ),
              0
            )
          ) /
            (rect.height || 1)) *
          100;

      sectionData.set(ref, entry);
    }

    willNavigate = false;
    sectionProgress$.next(sectionData);
  }

  function onWheel(ev: WheelEvent) {
    if (verticalMode && !$disableWheelNavigation$ && !$skipKeyDownListener$) {
      scrollFn(ev, fontSize, window.innerWidth);
    }
  }

  function onScroll() {
    requestAnimationFrame(() => {
      if (!calculator) return;

      exploredCharCount = calculator.calcExploredCharCount(customReadingPointScrollOffset);

      if (!isResizeScroll && exploredCharCount) {
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

    let fontLoaded = false;

    try {
      fontLoaded = document.fonts.check(`${fontSize}px ${fontFamilyGroupOne || 'Noto Serif JP'}`);
    } catch (error: any) {
      logger.error(`Error checking Font Load: ${error.message}`);
      fontLoaded = true;
    }

    if (fontLoaded) {
      dispatch('contentChange', contentEl);
    } else if (!fontLoadingAdded) {
      fontLoadingAdded = true;

      const timeout = isStoredFont(fontFamilyGroupOne, $userFonts$) ? 30000 : 10000;
      const fontLoadTimer = setTimeout(() => {
        if (!contentEl) {
          return;
        }

        logger.error(`Error loading primary Font: ${fontFamilyGroupOne}`);
        dispatch('contentChange', contentEl);
      }, timeout);

      document.fonts.addEventListener('loadingdone', () => {
        clearTimeout(fontLoadTimer);

        if (contentEl) {
          dispatch('contentChange', contentEl);
        }
      });
    }
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
        -(
          window.innerWidth -
          rect.right -
          (firstDimensionMargin || 0) -
          customReadingPointScrollOffset -
          (!customReadingPointScrollOffset ||
          (customReadingPointScrollOffset && scrollAdjustment > customReadingPointScrollOffset)
            ? scrollAdjustment
            : 0)
        ),
        0
      );
    } else {
      window.scrollBy(
        0,
        rect.top -
          (firstDimensionMargin || 0) -
          customReadingPointScrollOffset -
          (!customReadingPointScrollOffset ||
          (customReadingPointScrollOffset && scrollAdjustment > customReadingPointScrollOffset)
            ? scrollAdjustment
            : 0)
      );
    }
  });
</script>

<div
  bind:this={contentEl}
  style:color={fontColor}
  style:font-size="{fontSize}px"
  style:line-height={lineHeight}
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
  style:--book-content-text-margin="{textMarginValue ?? 0}rem"
  style:--book-content-text-intendation="{textIndentation ?? 0}rem"
  style:font-feature-settings={fontFeatureSettings}
  style:text-orientation={verticalTextOrientation}
  class:book-content--writing-vertical-rl={verticalMode}
  class:book-content--writing-horizontal-rl={!verticalMode}
  class:book-content--hide-furigana={hideFurigana}
  class:book-content--hide-spoiler-image={hideSpoilerImage}
  class:book-content--furigana-style-hide={furiganaStyle === FuriganaStyle.Hide}
  class:book-content--furigana-style-partial={furiganaStyle === FuriganaStyle.Partial}
  class:book-content--furigana-style-toggle={furiganaStyle === FuriganaStyle.Toggle}
  class:book-content--furigana-style-full={furiganaStyle === FuriganaStyle.Full}
  class:ttu-apply-important={prioritizeReaderStyles}
  class:ttu-apply-justification={enableTextJustification}
  class:ttu-text-wrap-pretty={enableTextWrapPretty}
  class="book-content m-auto"
>
  <HtmlRenderer html={htmlContent} on:load={onHtmlLoad} />
</div>

{#if firstDimensionMargin}
  <div
    class="fixed z-[5]"
    class:inset-y-0={verticalMode}
    class:inset-x-0={!verticalMode}
    style:background-color={backgroundColor}
    style="{fullLengthDimension}: 100%; {modifyingDimension}: {firstDimensionMargin}px; {boundSide[0]}: 0"
  />
  <div
    class="fixed z-[5]"
    class:inset-y-0={verticalMode}
    class:inset-x-0={!verticalMode}
    style:background-color={backgroundColor}
    style="{fullLengthDimension}: 100%; {modifyingDimension}: {firstDimensionMargin}px; {boundSide[1]}: 0"
  />
{/if}

{#if bookmarkPos}
  {#if verticalMode}
    <div
      class="pointer-events-none absolute text-xl opacity-25"
      style:color={fontColor}
      style:right={`calc(${bookmarkPos.right} + 1rem)`}
      style:top={bookmarkAdjustment}
    >
      <Fa icon={faBookmark} />
    </div>
  {:else}
    <div
      class="pointer-events-none absolute text-sm opacity-25 sm:text-xl"
      style:color={fontColor}
      style:left={bookmarkAdjustment}
      style:top={`calc(${bookmarkPos.top} + 1.5rem)`}
    >
      <Fa icon={faBookmark} />
    </div>
  {/if}
{/if}

{#if !allowDisplay}
  <div
    class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl"
    style:color={fontColor}
    style:background-color={backgroundColor}
  >
    <Fa icon={faSpinner} spin />
  </div>
{/if}

<svelte:body
  on:wheel|nonpassive={onWheel}
  on:mousedown={(e) => {
    if ($disableWheelNavigation$ && e.button === 1) {
      e.preventDefault();
    }
  }}
/>
<svelte:window
  on:scroll={onScroll}
  on:resize={() => {
    if (autoPositionOnResize) {
      isResizeScroll = true;
    }
  }}
/>

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
