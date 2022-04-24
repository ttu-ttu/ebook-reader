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
  import { ViewMode } from '$lib/data/view-mode';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import { writableSubject } from '$lib/functions/svelte/store';
  import { imageLoadingState } from './image-loading-state';
  import { reactiveElements } from './reactive-elements';
  import type { AutoScroller, BookmarkManager, PageManager } from './types';
  import BookReaderPaginated from './book-reader-paginated/book-reader-paginated.svelte';

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

  export let viewMode: ViewMode;

  export let exploredCharCount: number;

  export let bookCharCount: number;

  export let multiplier: number;

  export let bookmarkData: Promise<BooksDbBookmarkData | undefined>;

  export let autoScroller: AutoScroller | undefined;

  export let bookmarkManager: BookmarkManager | undefined;

  export let pageManager: PageManager | undefined;

  export let isBookmarkScreen: boolean;

  const width$ = new Subject<number>();

  const height$ = new Subject<number>();

  const containerEl$ = writableSubject<HTMLElement | null>(null);

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
    map((style) => width - parsePx(style.paddingLeft) - parsePx(style.paddingRight))
  );

  const contentViewportHeight$ = computedStyle$.pipe(
    map((style) => height - parsePx(style.paddingTop) - parsePx(style.paddingBottom))
  );

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

  $: width$.next(width);

  $: height$.next(height);

  function parsePx(px: string) {
    return Number(px.replace(/px$/, ''));
  }
</script>

<div bind:this={$containerEl$} class="{pxReader} py-8">
  {#if viewMode === ViewMode.Continuous}
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
      bind:exploredCharCount
      bind:bookCharCount
      bind:bookmarkData
      bind:autoScroller
      bind:bookmarkManager
      bind:pageManager
      on:contentChange={(ev) => contentEl$.next(ev.detail)}
    />
  {:else}
    <BookReaderPaginated
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
      loadingState={$imageLoadingState$ ?? true}
      bind:exploredCharCount
      bind:bookCharCount
      bind:isBookmarkScreen
      bind:bookmarkData
      bind:bookmarkManager
      bind:pageManager
      on:contentChange={(ev) => contentEl$.next(ev.detail)}
    />
  {/if}
</div>
{$reactiveElements$ ?? ''}
