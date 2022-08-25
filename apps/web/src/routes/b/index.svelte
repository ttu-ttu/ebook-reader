<script lang="ts">
  import {
    EMPTY,
    filter,
    fromEvent,
    map,
    share,
    shareReplay,
    startWith,
    switchMap,
    tap,
    timer
  } from 'rxjs';
  import { quintInOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import BookReader from '$lib/components/book-reader/book-reader.svelte';
  import type {
    AutoScroller,
    BookmarkManager,
    PageManager
  } from '$lib/components/book-reader/types';
  import StyleSheetRenderer from '$lib/components/style-sheet-renderer.svelte';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import {
    autoBookmark$,
    autoPositionOnResize$,
    avoidPageBreak$,
    bookReaderKeybindMap$,
    database,
    firstDimensionMargin$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    furiganaStyle$,
    hideFurigana$,
    hideSpoilerImage$,
    multiplier$,
    pageColumns$,
    secondDimensionMaxValue$,
    theme$,
    verticalMode$,
    writingMode$,
    viewMode$
  } from '$lib/data/store';
  import BookReaderHeader from '$lib/components/book-reader/book-reader-header.svelte';
  import BookToc from '$lib/components/book-reader/book-toc/book-toc.svelte';
  import { availableThemes } from '$lib/data/theme-option';
  import { fullscreenManager } from '$lib/data/fullscreen-manager';
  import loadBookData from '$lib/functions/book-data-loader/load-book-data';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import { readableToObservable } from '$lib/functions/rxjs/readable-to-observable';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import { takeWhenBrowser } from '$lib/functions/rxjs/take-when-browser';
  import { tapDom } from '$lib/functions/rxjs/tap-dom';
  import {
    getChapterData,
    nextChapter$,
    sectionList$,
    sectionProgress$,
    tocIsOpen$
  } from '$lib/components/book-reader/book-toc/book-toc';
  import { getStorageHandler } from '$lib/data/storage-manager/storage-manager-factory';
  import { StorageKey } from '$lib/data/storage-manager/storage-source';
  import { clickOutside } from '$lib/functions/use-click-outside';
  import { onKeydownReader } from './on-keydown-reader';

  let showHeader = true;
  let isBookmarkScreen = false;
  let showFooter = true;
  let exploredCharCount = 0;
  let bookCharCount = 0;
  let autoScroller: AutoScroller | undefined;
  let bookmarkManager: BookmarkManager | undefined;
  let pageManager: PageManager | undefined;
  let bookmarkData: Promise<BooksDbBookmarkData | undefined> = Promise.resolve(undefined);

  const autoHideHeader$ = timer(2500).pipe(
    tap(() => (showHeader = false)),
    reduceToEmptyString()
  );

  const bookId$ = iffBrowser(() => readableToObservable(page)).pipe(
    map((pageObj) => Number(pageObj.url.searchParams.get('id'))),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const rawBookData$ = bookId$.pipe(
    switchMap((id) => database.getData(id)),
    share()
  );

  const leaveIfBookMissing$ = rawBookData$.pipe(
    tap((data) => {
      if (!data) {
        goto('/manage');
      }
    }),
    reduceToEmptyString()
  );

  const initBookmarkData$ = rawBookData$.pipe(
    tap((rawBookData) => {
      if (!rawBookData) return;
      bookmarkData = database.getBookmark(rawBookData.id);
    }),
    reduceToEmptyString()
  );

  const bookData$ = rawBookData$.pipe(
    switchMap((rawBookData) => {
      if (!rawBookData) return EMPTY;

      // eslint-disable-next-line no-param-reassign
      rawBookData.lastBookOpen = new Date().getTime();
      getStorageHandler(StorageKey.BROWSER, window)
        .then((handler) => database.upsertData(rawBookData, handler))
        .catch(() => {
          // no-op
        });

      sectionList$.next(rawBookData.sections || []);

      return loadBookData(rawBookData, '.book-content', document);
    }),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const resize$ = iffBrowser(() => fromEvent(visualViewport, 'resize')).pipe(share());

  const containerViewportWidth$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport.width),
    takeWhenBrowser()
  );

  const containerViewportHeight$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport.height),
    takeWhenBrowser()
  );

  const themeOption$ = theme$.pipe(
    map((theme) => availableThemes.get(theme)),
    filter((o): o is NonNullable<typeof o> => !!o)
  );

  const backgroundColor$ = themeOption$.pipe(map((o) => o.backgroundColor));

  const backgroundStyleName = 'background-color';
  const setBackgroundColor$ = backgroundColor$.pipe(
    tapDom(
      () => document.body,
      (backgroundColor, body) => body.style.setProperty(backgroundStyleName, backgroundColor),
      (body) => body.style.removeProperty(backgroundStyleName)
    ),
    reduceToEmptyString(),
    takeWhenBrowser()
  );

  const writingModeStyleName = 'writing-mode';
  const setWritingMode$ = writingMode$.pipe(
    tapDom(
      () => document.documentElement,
      (writingMode, documentElement) =>
        documentElement.style.setProperty(writingModeStyleName, writingMode),
      (documentElement) => documentElement.style.removeProperty(writingModeStyleName)
    ),
    reduceToEmptyString(),
    takeWhenBrowser()
  );

  const sectionData$ = iffBrowser(() => sectionProgress$).pipe(
    map((sectionProgress) => [...sectionProgress.values()])
  );

  $: if ($tocIsOpen$) {
    autoScroller?.off();
  }

  function onKeydown(ev: KeyboardEvent) {
    const result = onKeydownReader(
      ev,
      bookReaderKeybindMap$.getValue(),
      bookmarkPage,
      scrollToBookmark,
      (x) => multiplier$.next(multiplier$.getValue() + x),
      autoScroller,
      pageManager,
      $verticalMode$,
      changeChapter
    );

    if (!result) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    ev.preventDefault();
  }

  function getBookIdSync() {
    let bookId: number | undefined;
    bookId$.subscribe((x) => (bookId = x)).unsubscribe();
    return bookId;
  }

  async function bookmarkPage() {
    const bookId = getBookIdSync();
    if (!bookId || !bookmarkManager) return;

    const data = bookmarkManager.formatBookmarkData(bookId);
    await database.putBookmark(data);
    bookmarkData = Promise.resolve(data);
  }

  async function scrollToBookmark() {
    const data = await bookmarkData;
    if (!data || !bookmarkManager) return;
    bookmarkManager.scrollToBookmark(data);
  }

  function onBookManagerClick() {
    database.deleteLastItem();
    bookmarkPage();
  }

  function onFullscreenClick() {
    if (!fullscreenManager.fullscreenElement) {
      fullscreenManager.requestFullscreen(document.documentElement);
      return;
    }
    fullscreenManager.exitFullscreen();
  }

  function changeChapter(offset: number) {
    if (!$sectionData$?.length) {
      return;
    }

    const [mainChapters, currentChapterIndex] = getChapterData($sectionData$);

    if (
      (!currentChapterIndex && offset === -1) ||
      (offset === 1 && currentChapterIndex === mainChapters.length - 1)
    ) {
      return;
    }

    nextChapter$.next(mainChapters[currentChapterIndex + offset].reference);
  }
</script>

<svelte:head>
  <title>{formatPageTitle($rawBookData$?.title ?? '')}</title>
</svelte:head>

{$autoHideHeader$ ?? ''}
<button class="fixed inset-x-0 top-0 z-10 h-8 w-full" on:click={() => (showHeader = true)} />
{#if showHeader}
  <div
    class="elevation-4 writing-horizontal-tb fixed inset-x-0 top-0 z-10 w-full"
    transition:fly|local={{ y: -300, easing: quintInOut }}
    use:clickOutside={() => (showHeader = false)}
  >
    <BookReaderHeader
      hasChapterData={!!$sectionData$?.length}
      showFullscreenButton={fullscreenManager.fullscreenEnabled}
      autoScrollMultiplier={$multiplier$}
      bind:isBookmarkScreen
      on:tocClick={() => {
        showHeader = false;
        tocIsOpen$.next(true);
      }}
      on:fullscreenClick={onFullscreenClick}
      on:bookmarkClick={bookmarkPage}
      on:bookManagerClick={onBookManagerClick}
      on:settingsClick={bookmarkPage}
    />
  </div>
{/if}

{#if $bookData$}
  <StyleSheetRenderer styleSheet={$bookData$.styleSheet} />
  <BookReader
    htmlContent={$bookData$.htmlContent}
    width={$containerViewportWidth$ ?? 0}
    height={$containerViewportHeight$ ?? 0}
    verticalMode={$verticalMode$}
    fontColor={$themeOption$?.fontColor}
    backgroundColor={$backgroundColor$}
    hintFuriganaFontColor={$themeOption$?.hintFuriganaFontColor}
    hintFuriganaShadowColor={$themeOption$?.hintFuriganaShadowColor}
    fontSize={$fontSize$}
    fontFamilyGroupOne={$fontFamilyGroupOne$}
    fontFamilyGroupTwo={$fontFamilyGroupTwo$}
    hideSpoilerImage={$hideSpoilerImage$}
    hideFurigana={$hideFurigana$}
    furiganaStyle={$furiganaStyle$}
    viewMode={$viewMode$}
    secondDimensionMaxValue={$secondDimensionMaxValue$}
    firstDimensionMargin={$firstDimensionMargin$}
    autoPositionOnResize={$autoPositionOnResize$}
    avoidPageBreak={$avoidPageBreak$}
    pageColumns={$pageColumns$}
    autoBookmark={$autoBookmark$}
    multiplier={$multiplier$}
    bind:exploredCharCount
    bind:bookCharCount
    bind:isBookmarkScreen
    bind:bookmarkData
    bind:autoScroller
    bind:bookmarkManager
    bind:pageManager
    on:bookmark={bookmarkPage}
  />
  {$initBookmarkData$ ?? ''}
  {$setBackgroundColor$ ?? ''}
  {$setWritingMode$ ?? ''}
{:else}
  {$leaveIfBookMissing$ ?? ''}
{/if}

{#if $tocIsOpen$}
  <div
    class="writing-horizontal-tb fixed top-0 left-0 z-[60] flex h-full w-full max-w-xl flex-col justify-between"
    style:color={$themeOption$?.fontColor}
    style:background-color={$backgroundColor$}
    in:fly|local={{ x: -100, duration: 100, easing: quintInOut }}
    use:clickOutside={() => tocIsOpen$.next(false)}
  >
    <BookToc sectionData={$sectionData$} verticalMode={$verticalMode$} {exploredCharCount} />
  </div>
{/if}

{#if showFooter && bookCharCount}
  <div
    class="writing-horizontal-tb fixed bottom-2 right-2 z-10 text-xs leading-none"
    style:color={$themeOption$?.tooltipTextFontColor}
  >
    {exploredCharCount} / {bookCharCount} ({((exploredCharCount / bookCharCount) * 100).toFixed(
      2
    )}%)
  </div>
{/if}
<button
  class="fixed inset-x-0 bottom-0 z-10 h-8 w-full cursor-pointer"
  on:click={() => (showFooter = !showFooter)}
/>

<svelte:window on:keydown={onKeydown} />
