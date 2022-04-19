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
    Subject
  } from 'rxjs';
  import BookReaderContinuous from '$lib/components/book-reader/book-reader-continuous/book-reader-continuous.svelte';
  import { pxReader } from '$lib/components/book-reader/css-classes';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import type { FuriganaStyle } from '$lib/data/furigana-style';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import { writableSubject } from '$lib/functions/svelte/store';
  import { imageLoadingState } from './image-loading-state';
  import { reactiveElements } from './reactive-elements';
  import type { AutoScroller, BookmarkManager, PageManager } from './types';

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

  export let multiplier: number;
  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;
  export let autoScroller: AutoScroller | undefined;
  export let bookmarkManager: BookmarkManager | undefined;
  export let pageManager: PageManager | undefined;

  const width$ = new Subject<number>();
  $: width$.next(width);

  const height$ = new Subject<number>();
  $: height$.next(height);

  const containerEl$ = writableSubject<HTMLElement | null>(null);

  const computedStyle$ = combineLatest([
    containerEl$.pipe(filter((el): el is HTMLElement => !!el)),
    combineLatest([width$, height$]).pipe(startWith(0))
  ]).pipe(
    debounceTime(0, animationFrameScheduler),
    map(([el]) => getComputedStyle(el)),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  function parsePx(px: string) {
    return Number(px.replace(/px$/, ''));
  }

  const contentViewportWidth$ = computedStyle$.pipe(
    map((style) => width - parsePx(style.paddingLeft) - parsePx(style.paddingRight))
  );

  const contentViewportHeight$ = computedStyle$.pipe(
    map((style) => height - parsePx(style.paddingTop) - parsePx(style.paddingBottom))
  );

  const contentEl$ = new ReplaySubject<HTMLElement>(1);
  const reactiveElements$ = iffBrowser(() => of(document)).pipe(
    mergeMap((document) => {
      const reactiveElementsFn = reactiveElements(document);
      return contentEl$.pipe(mergeMap((contentEl) => reactiveElementsFn(contentEl)));
    }),
    reduceToEmptyString()
  );

  const imageLoadingState$ = contentEl$.pipe(
    mergeMap((contentEl) => imageLoadingState(contentEl)),
    share()
  );

  async function onContentReady() {
    const data = await bookmarkData;
    if (!bookmarkManager || !data) return;

    bookmarkManager.scrollToBookmark(data);
  }
</script>

<div bind:this={$containerEl$} class="{pxReader} py-8">
  <BookReaderContinuous
    {htmlContent}
    width={$contentViewportWidth$ ?? 0}
    height={$contentViewportHeight$ ?? 0}
    {verticalMode}
    {fontColor}
    {backgroundColor}
    {hintFuriganaFontColor}
    {hintFuriganaShadowColor}
    {fontSize}
    {fontFamilyGroupOne}
    {fontFamilyGroupTwo}
    {hideSpoilerImage}
    {hideFurigana}
    {furiganaStyle}
    {secondDimensionMaxValue}
    {firstDimensionMargin}
    {multiplier}
    loadingState={$imageLoadingState$ ?? true}
    bind:bookmarkData
    bind:autoScroller
    bind:bookmarkManager
    bind:pageManager
    on:contentChange={(ev) => contentEl$.next(ev.detail)}
    on:contentReady={onContentReady}
    on:exploredCharCountChange
    on:bookCharCountChange
  />
</div>
{$reactiveElements$ ?? ''}
