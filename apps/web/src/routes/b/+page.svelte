<script lang="ts">
  import {
    auditTime,
    debounceTime,
    EMPTY,
    filter,
    fromEvent,
    map,
    merge,
    of,
    share,
    shareReplay,
    skip,
    startWith,
    switchMap,
    take,
    takeWhile,
    tap,
    timer
  } from 'rxjs';
  import { quintInOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { faCloudBolt, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import BookReader from '$lib/components/book-reader/book-reader.svelte';
  import type {
    AutoScroller,
    BookmarkManager,
    PageManager
  } from '$lib/components/book-reader/types';
  import LogReportDialog from '$lib/components/log-report-dialog.svelte';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import StyleSheetRenderer from '$lib/components/style-sheet-renderer.svelte';
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
    viewMode$,
    customReadingPointEnabled$,
    selectionToBookmarkEnabled$,
    lineHeight$,
    syncTarget$,
    autoReplication$,
    skipKeyDownListener$,
    replicationSaveBehavior$,
    cacheStorageData$,
    confirmClose$,
    verticalCustomReadingPosition$,
    horizontalCustomReadingPosition$,
    isOnline$,
    manualBookmark$,
    customThemes$
  } from '$lib/data/store';
  import BookReaderHeader from '$lib/components/book-reader/book-reader-header.svelte';
  import {
    getChapterData,
    nextChapter$,
    sectionList$,
    sectionProgress$,
    tocIsOpen$
  } from '$lib/components/book-reader/book-toc/book-toc';
  import BookToc from '$lib/components/book-reader/book-toc/book-toc.svelte';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import type {
    BooksDbBookData,
    BooksDbBookmarkData
  } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { pagePath } from '$lib/data/env';
  import { fullscreenManager } from '$lib/data/fullscreen-manager';
  import { logger } from '$lib/data/logger';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import type { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
  import type { BrowserStorageHandler } from '$lib/data/storage/handler/browser-handler';
  import {
    StorageDataType,
    StorageSourceDefault,
    StorageKey
  } from '$lib/data/storage/storage-types';
  import { storageSource$ } from '$lib/data/storage/storage-view';
  import { availableThemes } from '$lib/data/theme-option';
  import { ViewMode } from '$lib/data/view-mode';
  import loadBookData from '$lib/functions/book-data-loader/load-book-data';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { iffBrowser } from '$lib/functions/rxjs/iff-browser';
  import { AutoReplicationType } from '$lib/functions/replication/replication-options';
  import { replicateData } from '$lib/functions/replication/replicator';
  import { readableToObservable } from '$lib/functions/rxjs/readable-to-observable';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import { takeWhenBrowser } from '$lib/functions/rxjs/take-when-browser';
  import { tapDom } from '$lib/functions/rxjs/tap-dom';
  import { clickOutside } from '$lib/functions/use-click-outside';
  import { dummyFn, isMobile$ } from '$lib/functions/utils';
  import { onKeydownReader } from './on-keydown-reader';
  import { tick } from 'svelte';
  import Fa from 'svelte-fa';
  import { executeReplicate$ } from '$lib/functions/replication/replication-progress';
  import {
    clearRange,
    getParagraphToPoint,
    getRangeForUserSelection,
    getReferencePoints,
    pulseElement
  } from '$lib/functions/range-util';

  let showSpinner = true;
  let showHeader = true;
  let isBookmarkScreen = false;
  let showFooter = true;
  let exploredCharCount = 0;
  let bookCharCount = 0;
  let autoScroller: AutoScroller | undefined;
  let bookmarkManager: BookmarkManager | undefined;
  let pageManager: PageManager | undefined;
  let bookmarkData: Promise<BooksDbBookmarkData | undefined> = Promise.resolve(undefined);
  let customReadingPointTop = -2;
  let customReadingPointLeft = -2;
  let customReadingPoint = $verticalMode$
    ? $verticalCustomReadingPosition$
    : $horizontalCustomReadingPosition$;
  let customReadingPointScrollOffset = 0;
  let customReadingPointRange: Range | undefined;
  let lastSelectedRange: Range | undefined;
  let lastSelectedRangeWasEmpty = true;
  let isSelectingCustomReadingPoint = false;
  let showCustomReadingPoint = false;
  let localStorageHandler: BrowserStorageHandler;
  let dataToReplicate: StorageDataType[] = [];
  let dataToReplicateQueue: StorageDataType[] = [];
  let externalStorageHandler: BaseStorageHandler | undefined;
  let externalStorageErrors = 0;
  let isReplicating = false;
  let storedExploredCharacter = 0;
  let hasBookmarkData = false;

  const autoHideHeader$ = timer(2500).pipe(
    tap(() => (showHeader = false)),
    reduceToEmptyString()
  );

  const bookId$ = iffBrowser(() => readableToObservable(page)).pipe(
    map((pageObj) => Number(pageObj.url.searchParams.get('id'))),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const rawBookData$ = bookId$.pipe(
    switchMap(async (id) => {
      let bookData: BooksDbBookData | undefined;

      try {
        localStorageHandler = getStorageHandler(
          window,
          StorageKey.BROWSER,
          undefined,
          true,
          $cacheStorageData$,
          $replicationSaveBehavior$
        );

        localStorageHandler.startContext({ id, title: '' });
        bookData = await localStorageHandler.getBook();

        if (!bookData) {
          return bookData;
        }

        localStorageHandler.startContext({
          id: bookData.id,
          title: bookData.title,
          imagePath: bookData.coverImage
        });

        if (bookData.storageSource) {
          externalStorageHandler = await getStorageHandlerByName(bookData.storageSource, true);
        } else if ($autoReplication$ !== AutoReplicationType.Off) {
          externalStorageHandler = await getStorageHandlerByName($syncTarget$);
        }

        bookData.lastBookOpen = new Date().getTime();

        await localStorageHandler.updateLastRead(bookData);

        bookData = await saveExternalLastRead(externalStorageHandler, bookData);

        await syncDownData(externalStorageHandler);
      } catch (error: any) {
        const message = `Error loading book: ${error.message}`;

        logger.warn(message);

        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message
            }
          }
        ]);
        return undefined;
      } finally {
        showSpinner = false;
      }

      if (externalStorageHandler) {
        externalStorageHandler.updateSettings(
          window,
          true,
          $replicationSaveBehavior$,
          $cacheStorageData$,
          false,
          bookData.storageSource || $syncTarget$
        );
      }

      return bookData;
    }),
    share()
  );

  const leaveIfBookMissing$ = rawBookData$.pipe(
    tap((data) => {
      if (!data) {
        goto(`${pagePath}${mergeEntries.MANAGE.routeId}`);
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

      sectionList$.next(rawBookData.sections || []);

      return loadBookData(rawBookData, '.book-content', document);
    }),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  const resize$ = iffBrowser(() =>
    visualViewport ? fromEvent(visualViewport, 'resize') : of()
  ).pipe(share());

  const containerViewportWidth$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport?.width || 0),
    takeWhenBrowser()
  );

  const containerViewportHeight$ = resize$.pipe(
    startWith(0),
    map(() => visualViewport?.height || 0),
    takeWhenBrowser()
  );

  const themeOption$ = theme$.pipe(
    map(
      (theme) =>
        availableThemes.get(theme) || $customThemes$[theme] || availableThemes.get('light-theme')
    ),
    filter((o): o is NonNullable<typeof o> => !!o),
    takeWhenBrowser()
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

  const textSelector$ = iffBrowser(() => fromEvent(document, 'selectionchange')).pipe(
    debounceTime(200),
    tap(() => {
      const currentSelected = window.getSelection()?.toString() || '';

      if (!currentSelected && lastSelectedRangeWasEmpty) {
        lastSelectedRange = undefined;
      } else if (currentSelected) {
        lastSelectedRange = window.getSelection()?.getRangeAt(0);
        lastSelectedRangeWasEmpty = false;
      } else {
        lastSelectedRangeWasEmpty = true;
      }
    }),
    reduceToEmptyString()
  );

  const replicator$ = executeReplicate$.pipe(
    auditTime(60000),
    switchMap(() => executeReplication()),
    reduceToEmptyString()
  );

  $: if ($tocIsOpen$) {
    autoScroller?.off();
  }

  $: if (browser && bookCharCount) {
    document.dispatchEvent(new CustomEvent('ttsu:page.change', { detail: { exploredCharCount } }));
  }

  $: if (browser) {
    document.dispatchEvent(new CustomEvent('ttsu:page.change', { detail: { bookCharCount } }));
  }

  $: if (showCustomReadingPoint) {
    pulseElement(customReadingPointRange?.endContainer?.parentElement, 'add', 1);

    fromEvent(document, 'click')
      .pipe(skip(1), take(1))
      .subscribe(() => {
        showCustomReadingPoint = false;
        pulseElement(customReadingPointRange?.endContainer?.parentElement, 'remove', 1);
      });
  }

  $: isPaginated = $viewMode$ === ViewMode.Paginated;

  $: upSyncEnabled =
    externalStorageHandler &&
    ($autoReplication$ === AutoReplicationType.Up || $autoReplication$ === AutoReplicationType.All);

  $: bookmarkData.then((data) => {
    hasBookmarkData = !!data;
    storedExploredCharacter = data?.exploredCharCount || 0;
  });

  function handleUnload(event: BeforeUnloadEvent) {
    if (
      $confirmClose$ &&
      (isReplicating ||
        storedExploredCharacter !== exploredCharCount ||
        (upSyncEnabled && dataToReplicate.length) ||
        (upSyncEnabled && dataToReplicateQueue.length))
    ) {
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      return (event.returnValue = 'Are you sure you want to exit?');
    }

    return event;
  }

  async function getStorageHandlerByName(storageSourceName: string, throwIfNotFound = false) {
    if (!storageSourceName) {
      if (throwIfNotFound) {
        throw new Error(`No storage source found`);
      }

      return undefined;
    }

    if (storageSourceName === StorageSourceDefault.GDRIVE_DEFAULT) {
      if (!$isOnline$) {
        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message:
                'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
            }
          }
        ]);

        return undefined;
      }

      return getStorageHandler(
        window,
        StorageKey.GDRIVE,
        storageSourceName,
        true,
        $cacheStorageData$,
        $replicationSaveBehavior$
      );
    }
    if (storageSourceName === StorageSourceDefault.ONEDRIVE_DEFAULT) {
      if (!$isOnline$) {
        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Load Error',
              message:
                'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
            }
          }
        ]);

        return undefined;
      }

      return getStorageHandler(
        window,
        StorageKey.ONEDRIVE,
        storageSourceName,
        true,
        $cacheStorageData$,
        $replicationSaveBehavior$
      );
    }
    if (storageSourceName) {
      const db = await database.db;
      const storageSource = await db.get('storageSource', storageSourceName);

      if (storageSource) {
        if (storageSource.type !== StorageKey.FS && !$isOnline$) {
          dialogManager.dialogs$.next([
            {
              component: MessageDialog,
              props: {
                title: 'Load Error',
                message:
                  'Sync disabled due to missing Online Connection - refresh Page after going Online to try again'
              }
            }
          ]);

          return undefined;
        }

        return getStorageHandler(
          window,
          storageSource.type,
          storageSourceName,
          true,
          $cacheStorageData$,
          $replicationSaveBehavior$
        );
      }
      if (throwIfNotFound) {
        throw new Error(`No storage source with name ${storageSourceName} found`);
      }
    }

    const message = `No storage source with name ${storageSourceName} found - skipping auto import/export`;

    logger.warn(message);

    dialogManager.dialogs$.next([
      {
        component: MessageDialog,
        props: {
          title: 'Configuration Error',
          message
        }
      }
    ]);

    return undefined;
  }

  async function saveExternalLastRead(
    storageHandler: BaseStorageHandler | undefined,
    localBookData: BooksDbBookData
  ) {
    if (!storageHandler) {
      return localBookData;
    }

    if (!$cacheStorageData$) {
      storageHandler.clearData(false);
    }

    storageHandler.startContext({
      id: localBookData.id,
      title: localBookData.title,
      imagePath: localBookData.coverImage || ''
    });

    // eslint-disable-next-line prefer-const
    let { id, ...bookData } = localBookData;

    if (localBookData.storageSource) {
      const externalBookData = await storageHandler.getBook();

      if (externalBookData && !(externalBookData instanceof File)) {
        bookData = {
          ...externalBookData,
          ...{
            id: localBookData.id,
            lastBookOpen: localBookData.lastBookOpen,
            storageSource: localBookData.storageSource
          }
        };
      }
    } else if (!localBookData.elementHtml) {
      throw new Error('Book has no data stored');
    }

    const dataToReturn = { id, ...bookData };

    await storageHandler.updateLastRead(dataToReturn).catch((error: any) => {
      const message = `Failed to update last read on external storage: ${error.message}`;

      logger.warn(message);

      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Update Error',
            message
          }
        }
      ]);
    });

    return dataToReturn;
  }

  async function syncDownData(storageHandler: BaseStorageHandler | undefined) {
    if (
      localStorageHandler &&
      storageHandler &&
      ($autoReplication$ === AutoReplicationType.Down ||
        $autoReplication$ === AutoReplicationType.All)
    ) {
      const externalProgress = await storageHandler.getProgress();

      if (externalProgress && !(externalProgress instanceof File)) {
        await localStorageHandler.saveProgress(externalProgress);

        storedExploredCharacter = externalProgress.exploredCharCount || 0;
      }
    }
  }

  function onKeydown(ev: KeyboardEvent) {
    if ($skipKeyDownListener$) {
      return;
    }

    const result = onKeydownReader(
      ev,
      bookReaderKeybindMap$.getValue(),
      bookmarkPage,
      scrollToBookmark,
      (x) => multiplier$.next(multiplier$.getValue() + x),
      autoScroller,
      pageManager,
      $verticalMode$,
      changeChapter,
      handleSetCustomReadingPoint
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

  async function bookmarkPage(scheduleExport: boolean | CustomEvent) {
    const bookId = getBookIdSync();
    if (!bookId || !bookmarkManager) return;

    let data: BooksDbBookmarkData;

    showHeader = false;

    if (isPaginated) {
      const userSelectedRange = $selectionToBookmarkEnabled$
        ? getRangeForUserSelection(window, lastSelectedRange)
        : undefined;
      const bookmarkRange = userSelectedRange || customReadingPointRange;

      pulseElement(bookmarkRange?.endContainer?.parentElement, 'add', 0.5, 500);

      data = bookmarkManager.formatBookmarkDataByRange(bookId, bookmarkRange);

      if (userSelectedRange) {
        clearRange(window);
      }
    } else {
      data = bookmarkManager.formatBookmarkData(bookId, customReadingPointScrollOffset);
    }

    await localStorageHandler.saveProgress(data);

    if (upSyncEnabled) {
      const toReplicate = isReplicating ? dataToReplicateQueue : dataToReplicate;

      if (!toReplicate.includes(StorageDataType.PROGRESS)) {
        toReplicate.push(StorageDataType.PROGRESS);
      }

      if (scheduleExport) {
        executeReplicate$.next();
      }
    }

    bookmarkData = Promise.resolve(data);
  }

  async function scrollToBookmark() {
    const data = await bookmarkData;
    if (!data || !bookmarkManager) return;

    bookmarkManager.scrollToBookmark(data, customReadingPointScrollOffset);
  }

  function onFullscreenClick() {
    showHeader = false;

    if (!fullscreenManager.fullscreenElement) {
      fullscreenManager.requestFullscreen(document.documentElement);
      return;
    }
    fullscreenManager.exitFullscreen();
  }

  function onDomainHintClick() {
    dialogManager.dialogs$.next([
      {
        component: MessageDialog,
        props: {
          title: 'Old Domain',
          message:
            'You are currently using the old domain of ッツ Reader - consider switching to https://reader.ttsu.app to prevent issues and to ensure full features'
        },
        disableCloseOnClick: true
      }
    ]);
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

  async function executeReplication(isSilent = true) {
    if (isReplicating || !dataToReplicate.length || !$rawBookData$ || !externalStorageHandler) {
      return;
    }

    isReplicating = true;

    if (!isSilent) {
      skipKeyDownListener$.next(true);
      logger.clearHistory();
      openActionBackdrop();
    }

    const currentHandlerStorageSource = $rawBookData$.storageSource || $syncTarget$;

    externalStorageHandler.updateSettings(
      window,
      false,
      $replicationSaveBehavior$,
      $cacheStorageData$,
      !isSilent,
      currentHandlerStorageSource
    );

    const error = await replicateData(
      localStorageHandler,
      externalStorageHandler,
      !isSilent && $storageSource$ === externalStorageHandler.storageType,
      [
        {
          id: $rawBookData$.id,
          title: $rawBookData$.title,
          imagePath: $rawBookData$.coverImage
        }
      ],
      dataToReplicate
    ).catch((err: any) => err.message);

    externalStorageHandler.updateSettings(
      window,
      true,
      $replicationSaveBehavior$,
      $cacheStorageData$,
      false,
      currentHandlerStorageSource
    );

    isReplicating = false;

    if (error) {
      if (!isSilent) {
        const showReport = logger.errorCount > 1;

        logger.warn(error);

        dialogManager.dialogs$.next([
          {
            component: showReport ? LogReportDialog : MessageDialog,
            props: {
              title: 'Error Processing Data',
              message: showReport
                ? `Some or all data could not be stored on an external storage`
                : error
            }
          }
        ]);
      }

      externalStorageErrors += 1;
    } else {
      externalStorageErrors = 0;

      if (!isSilent) {
        dialogManager.dialogs$.next([]);
      }

      if (dataToReplicateQueue.length) {
        dataToReplicate = JSON.parse(JSON.stringify(dataToReplicateQueue));
        dataToReplicateQueue = [];

        if (isSilent) {
          executeReplicate$.next();
        } else {
          await executeReplication(false);
        }
      } else {
        dataToReplicate = [];
      }
    }

    if (!isSilent) {
      skipKeyDownListener$.next(false);
    }
  }

  function openActionBackdrop() {
    dialogManager.dialogs$.next([
      {
        component: '<div/>',
        disableCloseOnClick: true
      }
    ]);
  }

  async function leaveReader(routeId: string, deleteLastItem = true) {
    openActionBackdrop();

    let message;

    try {
      if (deleteLastItem) {
        await database.deleteLastItem();
      }

      if (!$manualBookmark$) {
        await bookmarkPage(false);
      }

      dialogManager.dialogs$.next([]);

      if (upSyncEnabled) {
        await executeReplication(false);
      }
    } catch (error: any) {
      message = error.message;
    }

    if (message) {
      logger.warn(message);

      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message
          },
          disableCloseOnClick: true
        }
      ]);
    }

    goto(`${pagePath}${routeId}`);
  }

  function handleSetCustomReadingPoint() {
    const contentEl = document.querySelector('.book-content');

    if (!contentEl) {
      return;
    }

    if (isPaginated) {
      customReadingPointTop = window.innerHeight / 2 - 2;
      customReadingPointLeft = window.innerWidth / 2 - 2;
    }

    showHeader = false;
    isSelectingCustomReadingPoint = true;
    document.body.classList.add('cursor-crosshair');

    const {
      elLeftReferencePoint,
      elTopReferencePoint,
      elRightReferencePoint,
      elBottomReferencePoint,
      pointGap
    } = getReferencePoints(window, contentEl, $verticalMode$, $firstDimensionMargin$);

    merge(fromEvent(document, 'pointerup'), fromEvent(document, 'pointermove'))
      // eslint-disable-next-line rxjs/no-ignored-takewhile-value
      .pipe(takeWhile(() => isSelectingCustomReadingPoint))
      .subscribe((event: Event) => {
        if (!(event instanceof PointerEvent)) {
          return;
        }

        if (event.type === 'pointerup') {
          document.body.classList.remove('cursor-crosshair');
          isSelectingCustomReadingPoint = false;

          tick().then(() => {
            customReadingPointLeft = $verticalMode$ ? event.x : customReadingPointLeft;
            customReadingPointTop = $verticalMode$ ? customReadingPointTop : event.y;

            const result = getParagraphToPoint(customReadingPointLeft, customReadingPointTop);

            if (result) {
              pulseElement(result.parent, 'add', 0.5, 500);
            }

            if (isPaginated) {
              customReadingPointRange = result?.range;
            } else {
              let newPercentage = 0;

              if ($verticalMode$) {
                newPercentage = Math.ceil(
                  (Math.max(0, customReadingPointLeft - elLeftReferencePoint) /
                    (elRightReferencePoint - elLeftReferencePoint)) *
                    100
                );

                verticalCustomReadingPosition$.next(newPercentage);
              } else {
                newPercentage = Math.ceil(
                  (Math.max(0, customReadingPointTop - elTopReferencePoint) /
                    (elBottomReferencePoint - elTopReferencePoint)) *
                    100
                );

                horizontalCustomReadingPosition$.next(newPercentage);
              }

              customReadingPoint = newPercentage;
            }
          });
        } else {
          const insideXBound =
            event.x >= elLeftReferencePoint + pointGap && event.x <= elRightReferencePoint;
          const insideYBound =
            event.y >= elTopReferencePoint && event.y <= elBottomReferencePoint - pointGap;

          if (isPaginated) {
            customReadingPointTop = insideYBound ? event.y : customReadingPointTop;
            customReadingPointLeft = insideXBound ? event.x : customReadingPointLeft;
          } else if ($verticalMode$ && insideXBound) {
            customReadingPointLeft = event.x;
          } else if (!$verticalMode$ && insideYBound) {
            customReadingPointTop = event.y;
          }
        }
      });
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
      hasCustomReadingPoint={!!(
        $customReadingPointEnabled$ &&
        ((isPaginated && customReadingPointRange) ||
          (!isPaginated && customReadingPointLeft > -1 && customReadingPointTop > -1))
      )}
      showFullscreenButton={fullscreenManager.fullscreenEnabled}
      autoScrollMultiplier={$multiplier$}
      {hasBookmarkData}
      bind:isBookmarkScreen
      on:tocClick={() => {
        showHeader = false;
        tocIsOpen$.next(true);
      }}
      on:setCustomReadingPoint={handleSetCustomReadingPoint}
      on:showCustomReadingPoint={() => {
        showHeader = false;
        showCustomReadingPoint = true;
      }}
      on:resetCustomReadingPoint={() => {
        showHeader = false;

        if (isPaginated) {
          customReadingPointRange = undefined;
        } else if ($verticalMode$) {
          verticalCustomReadingPosition$.next(100);
          customReadingPoint = 100;
        } else {
          horizontalCustomReadingPosition$.next(0);
          customReadingPoint = 0;
        }
      }}
      on:fullscreenClick={onFullscreenClick}
      on:bookmarkClick={bookmarkPage}
      on:scrollToBookmarkClick={() => {
        showHeader = false;
        scrollToBookmark();
      }}
      on:settingsClick={() => leaveReader(mergeEntries.SETTINGS.routeId, false)}
      on:domainHintClick={onDomainHintClick}
      on:bookManagerClick={() => leaveReader(mergeEntries.MANAGE.routeId)}
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
    fontFamilyGroupOne={$fontFamilyGroupOne$}
    fontFamilyGroupTwo={$fontFamilyGroupTwo$}
    fontSize={$fontSize$}
    lineHeight={$lineHeight$}
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
    bind:customReadingPoint
    bind:customReadingPointTop
    bind:customReadingPointLeft
    bind:customReadingPointScrollOffset
    bind:customReadingPointRange
    bind:showCustomReadingPoint
    on:bookmark={bookmarkPage}
  />
  {$initBookmarkData$ ?? ''}
  {$setBackgroundColor$ ?? ''}
  {$setWritingMode$ ?? ''}
  {$textSelector$ ?? ''}
  {$replicator$ ?? ''}
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

{#if (isSelectingCustomReadingPoint && !$isMobile$) || (!isPaginated && showCustomReadingPoint)}
  <div
    class="fixed left-0 z-20 h-[1px] w-full border border-red-500"
    style:top={`${customReadingPointTop}px`}
  />
  <div
    class="fixed top-0 z-20 h-full w-[1px] border border-red-500"
    style:left={`${customReadingPointLeft}px`}
  />
{/if}

{#if showSpinner}
  <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
    <Fa icon={faSpinner} spin />
  </div>
{/if}

<div
  role="button"
  tabindex="0"
  class="writing-horizontal-tb fixed bottom-0 left-0 z-10 flex h-8 w-full items-center justify-between text-xs leading-none"
  style:color={$themeOption$?.tooltipTextFontColor}
  on:click={() => (showFooter = !showFooter)}
  on:keyup={dummyFn}
>
  <div class="h-full">
    {#if dataToReplicate.length}
      <div
        role="button"
        tabindex="0"
        class="flex h-full w-8 items-center justify-center text-lg"
        class:text-red-500={externalStorageErrors > 1}
        class:animate-pulse={externalStorageErrors > 1 || isReplicating}
        on:click|stopPropagation={() => executeReplication(false)}
        on:keyup={dummyFn}
      >
        <Fa icon={faCloudBolt} />
      </div>
    {/if}
  </div>
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
</div>

<svelte:window on:keydown={onKeydown} on:beforeunload={handleUnload} />
