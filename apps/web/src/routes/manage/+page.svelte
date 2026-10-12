<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    faCalendarXmark,
    faChartLine,
    faCheckDouble,
    faCircleXmark,
    faCloudArrowUp,
    faFileImport,
    faBook,
    faBookOpen,
    faGaugeHigh,
    faHouse,
    faLayerGroup,
    faPlus,
    faRotateLeft,
    faStore,
    faTrash,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import BookCardList from '$lib/components/book-card/book-card-list.svelte';
  import BookCardTable from '$lib/components/book-card/book-card-table.svelte';
  import ContinueReadingShelf from '$lib/components/book-card/continue-reading-shelf.svelte';
  import LearnerDashboard from '$lib/components/book-card/learner-dashboard.svelte';
  import SeriesGrid from '$lib/components/book-card/series-grid.svelte';
  import SeriesResults from '$lib/components/book-card/series-results.svelte';
  import {
    addToHome,
    homeBookTitles$,
    libraryTab$,
    matchingSeries,
    removeFromHome,
    seriesGroups,
    storeView$
  } from '$lib/data/library-home';
  import DifficultyDialog from '$lib/components/book-card/difficulty-dialog.svelte';
  import {
    allBooksFilter,
    filterBookCards,
    isReading,
    seriesFilterKey
  } from '$lib/components/book-card/library-filters';
  import LibrarySidebar from '$lib/components/book-card/library-sidebar.svelte';
  import LibrarySkeleton from '$lib/components/book-card/library-skeleton.svelte';
  import {
    compareBookCards,
    nextSortOption,
    orderSeries
  } from '$lib/components/book-card/library-sort';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import BookManagerHeader from '$lib/components/book-card/book-manager-header.svelte';
  import SeriesDialog from '$lib/components/book-card/series-dialog.svelte';
  import SeriesSuggestionsDialog from '$lib/components/book-card/series-suggestions-dialog.svelte';
  import BookExportDialog from '$lib/components/book-export/book-export-dialog.svelte';
  import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
  import ExternalReadDialog from '$lib/components/external-read-dialog.svelte';
  import LogReportDialog from '$lib/components/log-report-dialog.svelte';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import { preFilteredTitlesForStatistics$ } from '$lib/components/statistics/statistics-types';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import { saveSeriesOverrides, seriesForTitle } from '$lib/data/series-overrides';
  import { account$, currentAccount, hasPermission } from '$lib/data/account';
  import {
    isFinished,
    uploadToCalibre,
    waitForImportJobs,
    type CalibreImportJob
  } from '$lib/data/calibre-import';
  import { clearReadingProgress } from '$lib/functions/clear-reading-progress';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { pagePath } from '$lib/data/env';
  import { logger } from '$lib/data/logger';
  import type { SortOption } from '$lib/data/sort-types';
  import { ApiStorageHandler } from '$lib/data/storage/handler/api-handler';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import { storageSource$ } from '$lib/data/storage/storage-view';
  import {
    booklistSortOptions$,
    cacheStorageData$,
    confirmStatisticsDeletion$,
    database,
    fileCountData$,
    hideExternalReadHint$,
    isOnline$,
    keepLocalStatisticsOnDeletion$,
    libraryDisplayMode$,
    lastExportedTarget$,
    lastExportedTypes$,
    readingGoalsMergeMode$,
    replicationSaveBehavior$,
    showExternalPlaceholder$,
    statisticsMergeMode$
  } from '$lib/data/store';
  import { cloneMutateSet } from '$lib/functions/clone-mutate-set';
  import { getDropEventFiles } from '$lib/functions/file-dom/get-drop-event-files';
  import { inputFile } from '$lib/functions/file-dom/input-file';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { keyBy } from '$lib/functions/key-by';
  import { handleErrorDuringReplication } from '$lib/functions/replication/error-handler';
  import { importBackup, importData, replicateData } from '$lib/functions/replication/replicator';
  import { throwIfAborted } from '$lib/functions/replication/replication-error';
  import {
    replicationProgress$,
    executeReplicate$,
    type ReplicationProgress
  } from '$lib/functions/replication/replication-progress';
  import { pluralize } from '$lib/functions/utils';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import pLimit from 'p-limit';
  import { combineLatest, map, Observable, share, Subject, switchMap, takeUntil } from 'rxjs';
  import { onDestroy, tick } from 'svelte';
  import Fa from 'svelte-fa';

  const booksAreLoading$ = database.listLoading$.pipe(map((isLoading) => isLoading));

  const bookCards$: Observable<BookCardProps[]> = combineLatest([
    database.dataList$,
    database.bookmarks$,
    booklistSortOptions$
  ]).pipe(
    map(([dataList, bookmarks]) => {
      const sortProp = $booklistSortOptions$[$storageSource$];

      if ($storageSource$ === StorageKey.BROWSER) {
        const bookmarkMap = keyBy(bookmarks, 'dataId');

        return [
          ...dataList
            .filter((d) => $showExternalPlaceholder$ || !d.isPlaceholder)
            .map((d) => ({
              ...d,
              ...bookmarkToProgress(bookmarkMap.get(d.id))
            }))
            .sort((card1: BookCardProps, card2: BookCardProps) =>
              compareBookCards(card1, card2, sortProp)
            )
        ];
      }

      return [
        ...dataList.sort((card1: BookCardProps, card2: BookCardProps) =>
          compareBookCards(card1, card2, sortProp)
        )
      ];
    }),
    share()
  );

  const currentBookId$ = database.lastItem$.pipe(
    map((item) => item?.dataId),
    share()
  );

  const renderStep = 120;

  let selectedBookIds: ReadonlySet<number> = new Set();
  let renderLimit = renderStep;
  let activeFilter = allBooksFilter.key;
  let searchTerm = '';
  let selectMode = false;
  let cancelToken = new AbortController();
  let cancelSignal = cancelToken.signal;
  let cancelTooltip = '';
  let replicationProgress = 0;
  let replicationToProgress = 0;
  let replicationProgressRemaining = '~ ??:??:??';
  let replicationDone = new Subject<void>();
  let progressBase = 0;
  let executionStart: number;

  $: {
    if (!selectMode) {
      selectedBookIds = new Set();
    }
  }

  // One series (Store → Series) is shown in reading order rather than the chosen sort.
  $: visibleBookCards = activeFilter.startsWith('series:')
    ? orderSeries(filterBookCards($bookCards$ ?? [], activeFilter, searchTerm))
    : filterBookCards($bookCards$ ?? [], activeFilter, searchTerm);
  // Large libraries (Calibre) are rendered in steps to keep the DOM small.
  $: (activeFilter, searchTerm, $storageSource$, (renderLimit = renderStep));
  $: renderedBookCards = visibleBookCards.slice(0, renderLimit);
  $: isLoading = !$bookCards$ || $booksAreLoading$;
  $: hasActiveFilter = activeFilter !== allBooksFilter.key || !!searchTerm.trim();
  $: isHome = $libraryTab$ !== 'store';
  // Selecting works on the Store's list.
  $: if (selectMode) {
    $libraryTab$ = 'store';
  }
  $: showSeriesGrid = !isHome && $storeView$ === 'series';
  $: seriesMatches = isHome || showSeriesGrid ? [] : matchingSeries($bookCards$ ?? [], searchTerm);

  function showSeries(series: string) {
    activeFilter = seriesFilterKey(series);
    searchTerm = '';
    $storeView$ = 'books';
  }

  function setStoreView(view: 'books' | 'series') {
    if (view === 'series' && activeFilter.startsWith('series:')) {
      activeFilter = allBooksFilter.key;
    }
    $storeView$ = view;
  }
  $: homeCards = (() => {
    const byTitle = new Map(($bookCards$ ?? []).map((card) => [card.title, card]));

    return $homeBookTitles$
      .map((title) => byTitle.get(title))
      .filter((card): card is BookCardProps => !!card && !isReading(card));
  })();

  function addSelectedToHome() {
    addToHome(
      ($bookCards$ ?? []).filter((card) => selectedBookIds.has(card.id)).map((card) => card.title)
    );
    selectMode = false;
  }

  onDestroy(() => dialogManager.dialogs$.next([]));

  function bookmarkToProgress(b: BooksDbBookmarkData | undefined) {
    return b?.progress
      ? {
          progress: typeof b.progress === 'string' ? +b.progress.slice(0, -1) : b.progress,
          lastBookmarkModified: b.lastBookmarkModified || 0
        }
      : { progress: 0, lastBookmarkModified: 0 };
  }

  async function onBookClick(bookId: number) {
    if (!operationAllowed()) {
      return;
    }

    if (!selectMode) {
      dialogManager.dialogs$.next([
        {
          component: '<div/>',
          disableCloseOnClick: true
        }
      ]);

      let idToOpen = bookId;

      try {
        const bookItem = $bookCards$.find((book) => book.id === bookId);

        if (!bookItem) {
          throw new Error('Book title not found');
        }

        const isForBrowser = $storageSource$ === StorageKey.BROWSER;
        const handler = getStorageHandler(
          window,
          $storageSource$,
          '',
          isForBrowser,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        );

        if (!cacheStorageData$) {
          handler.clearData(false);
        }

        handler.startContext({
          id: isForBrowser ? bookItem.id : 0,
          title: bookItem.title,
          imagePath: bookItem.imagePath
        });

        idToOpen = await handler.prepareBookForReading();

        if (
          !$hideExternalReadHint$ &&
          handler instanceof ApiStorageHandler &&
          handler.storageType !== StorageKey.CALIBRE
        ) {
          const nextAction = await new Promise<string>((resolver) => {
            dialogManager.dialogs$.next([
              {
                component: ExternalReadDialog,
                props: { resolver },
                disableCloseOnClick: true
              }
            ]);
          });

          if (nextAction === 'cancel') {
            return;
          }

          if (nextAction === 'export') {
            selectedBookIds = cloneMutateSet(selectedBookIds, (set) => {
              set.add(bookId);
            });
            selectMode = true;

            await tick();

            return onReplicateData();
          }
        }

        dialogManager.dialogs$.next([]);
      } catch (error: any) {
        const message = `Error opening book: ${error.message}`;

        logger.warn(message);

        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Error',
              message
            }
          }
        ]);

        return;
      }

      openBook(idToOpen);
      return;
    }

    selectedBookIds = cloneMutateSet(selectedBookIds, (set) => {
      if (set.has(bookId)) {
        set.delete(bookId);
        return;
      }
      set.add(bookId);
    });
  }

  // Store clicks select books (opened with "Read"); Home clicks open them, and a long press selects.
  function onStoreBookClick(bookId: number) {
    selectMode = true;
    onBookClick(bookId);
  }

  /** Selects a book without toggling (long press can fire twice), which opens the Store. */
  function selectBook(bookId: number) {
    selectMode = true;
    selectedBookIds = new Set([...selectedBookIds, bookId]);
  }

  function readSelected() {
    const [bookId] = selectedBookIds;

    selectMode = false;
    onBookClick(bookId);
  }

  function operationAllowed() {
    const connectivityPass = !(
      ($storageSource$ === StorageKey.GDRIVE || $storageSource$ === StorageKey.ONEDRIVE) &&
      !$isOnline$
    );

    if (!connectivityPass && !replicationToProgress) {
      const message = 'You have to be online for this operation';

      logger.warn(message);

      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Failure',
            message
          }
        }
      ]);
    }

    return !replicationToProgress && connectivityPass;
  }

  function openBook(bookId: number) {
    if (!bookId) {
      return;
    }

    database.putLastItem(bookId);
    gotoBook(bookId);
  }

  async function gotoBook(id: number) {
    await goto(`${pagePath}/b?id=${id}`);
  }

  async function onFilesChange(fileList: FileList | File[]) {
    if (!operationAllowed()) {
      return;
    }

    cancelTooltip = `Cancels the current Import\nAlready imported data will not be deleted`;

    initializeReplicationProgressData();

    const supportedExtRegex = /\.(?:htmlz|epub|txt|cbz|zip)$/;
    const files = Array.from(fileList).filter((f) => supportedExtRegex.test(f.name));
    const errorTitle = 'Bookimport failed';

    if (!files.length) {
      resetProgress();

      showError(errorTitle, 'File(s) must be HTMLZ, TXT, EPUB, CBZ or ZIP', '');
      return;
    }

    if ($storageSource$ === StorageKey.CALIBRE) {
      await addFilesToCalibre(files);
      return;
    }

    const error = await importData(
      document,
      getStorageHandler(
        window,
        $storageSource$,
        '',
        $storageSource$ === StorageKey.BROWSER,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      ),
      files,
      cancelSignal,
      $fileCountData$
    ).catch((catchedError) => catchedError.message);

    resetProgress();

    if (error) {
      showError(errorTitle, error, 'Error(s) occurred during bookimport');
    }
  }

  /**
   * Not part of upstream: under the Calibre source, imported files are added to the Calibre
   * library by the server's import queue (data/calibre-import.ts), which skips books
   * already there. The library is refreshed once they are in the catalog.
   */
  async function addFilesToCalibre(files: File[]) {
    if (!hasPermission(currentAccount(), 'import')) {
      resetProgress();
      showError(
        'Adding to Calibre failed',
        currentAccount()
          ? 'This account may not add books to Calibre. Ask an admin for the "Add books" permission.'
          : 'Sign in (Settings → Account, on the HTTPS address) to add books to Calibre',
        ''
      );
      return;
    }

    cancelTooltip = 'Stops uploading\nBooks already uploaded are still added to Calibre';
    replicationProgress$.next({ progressBase: 1, maxProgress: files.length * 2 });

    const ids: string[] = [];
    const failures: string[] = [];
    let jobs: CalibreImportJob[] = [];

    for (const file of files) {
      if (cancelSignal.aborted) {
        break;
      }

      try {
        ids.push((await uploadToCalibre(file, cancelSignal)).id);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          break;
        }
        failures.push(error.message);
      }

      replicationProgress$.next({ progressToAdd: 1 });
    }

    if (ids.length) {
      let finished = 0;

      try {
        jobs = await waitForImportJobs(ids, (current) => {
          const now = current.filter(isFinished).length;

          replicationProgress$.next({ progressToAdd: now - finished });
          finished = now;
        });
      } catch (error: any) {
        failures.push(error.message);
      }
    }

    resetProgress();

    const added = jobs.filter((job) => job.state === 'added');
    const duplicates = jobs.filter((job) => job.state === 'duplicate');

    jobs
      .filter((job) => job.state === 'failed')
      .forEach((job) => failures.push(`${job.name}: ${job.error}`));

    let books = $bookCards$ ?? [];

    if (added.length) {
      const handler = getStorageHandler(window, $storageSource$, '');

      handler.clearData();

      try {
        books = await handler.getBookList();
      } catch (error: any) {
        failures.push(error.message);
      }
      database.dataListChanged$.next(handler);
    }

    const newTitles = added.flatMap((job) => {
      const card = books.find((book) => book.calibreId === job.calibreId);

      return card && !card.series ? [card.title] : [];
    });

    await offerSeriesForImports(books, newTitles);

    if (failures.length || duplicates.length) {
      const summary = [
        added.length ? `Added ${pluralize(added.length, 'book')}.` : '',
        duplicates.length
          ? `Already in Calibre: ${duplicates.map((job) => job.name).join(', ')}.`
          : '',
        failures.length ? `Failed: ${failures.join(', ')}` : ''
      ]
        .filter(Boolean)
        .join(' ');

      logger.warn(summary);
      dialogManager.dialogs$.next([
        { component: MessageDialog, props: { title: 'Adding to Calibre', message: summary } }
      ]);
    }
  }

  /** Asks to add each imported book to the existing series its title names, if any. */
  async function offerSeriesForImports(libraryBooks: BookCardProps[], titles: string[]) {
    const suggestions = titles
      .map((title) => ({ title, series: seriesForTitle(libraryBooks, title) }))
      .filter((suggestion) => suggestion.series);

    if (!suggestions.length) {
      return;
    }

    // One dialog for the whole import, not one per book.
    const changes = await new Promise<Record<string, string>>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: SeriesSuggestionsDialog,
          props: { suggestions, resolver },
          disableCloseOnClick: true
        }
      ]);
    });

    if (!Object.keys(changes).length) {
      return;
    }

    try {
      await saveSeriesOverrides(changes);
      database.dataListChanged$.next(getStorageHandler(window, $storageSource$, ''));
    } catch (error: any) {
      showError('Adding to series failed', error.message, '');
    }
  }

  async function onMakeSeries() {
    const books = $bookCards$ ?? [];
    const book = books.find((card) => selectedBookIds.has(card.id));

    if (!book) {
      return;
    }

    const saved = await new Promise<boolean>((resolver) => {
      dialogManager.dialogs$.next([{ component: SeriesDialog, props: { book, books, resolver } }]);
    });

    if (saved) {
      selectMode = false;
      database.dataListChanged$.next(getStorageHandler(window, $storageSource$, ''));
    }
  }

  function renderMoreOnVisible(node: HTMLElement) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          renderLimit += renderStep;
        }
      },
      { rootMargin: '800px' }
    );

    observer.observe(node);

    return { destroy: () => observer.disconnect() };
  }

  function showError(title: string, message: string, fallbackMessage: string) {
    const showReport = logger.errorCount > 1;

    logger.warn(message);

    dialogManager.dialogs$.next([
      {
        component: showReport ? LogReportDialog : MessageDialog,
        props: {
          title,
          message: showReport ? fallbackMessage : message
        }
      }
    ]);
  }

  function initializeReplicationProgressData() {
    replicationDone = new Subject<void>();
    replicationProgress$.pipe(takeUntil(replicationDone)).subscribe(updateProgress);
    replicationProgressRemaining = '~ ??:??:??';
    replicationProgress = 0;
    replicationToProgress = 1;
    executionStart = Date.now();

    logger.clearHistory();

    cancelToken = new AbortController();
    cancelSignal = cancelToken.signal;
  }

  function resetProgress() {
    replicationDone.next();
    replicationDone.complete();
    replicationToProgress = 0;
    replicationProgress = 0;
    cancelTooltip = '';
  }

  function onSelectAllBooks() {
    const bookCards = visibleBookCards;
    selectedBookIds = cloneMutateSet(selectedBookIds, (set) => {
      bookCards.forEach((x) => set.add(x.id));
    });
  }

  function onSortChange(property: SortOption['property']) {
    booklistSortOptions$.next({
      ...$booklistSortOptions$,
      [$storageSource$]: nextSortOption($booklistSortOptions$[$storageSource$], property)
    });
  }

  function onSelectionToStatistics() {
    $preFilteredTitlesForStatistics$ = new Set(
      $bookCards$.filter((card) => selectedBookIds.has(card.id)).map((book) => book.title)
    );

    goto(`${pagePath}${mergeEntries.STATISTICS.routeId}`);
  }

  function clearFilters() {
    activeFilter = allBooksFilter.key;
    searchTerm = '';
  }

  async function removeBooks(bookIds: number[]) {
    if (!operationAllowed()) {
      return;
    }

    cancelTooltip = `Cancels the Deletion\nAlready deleted data will not be restored`;

    initializeReplicationProgressData();

    const currentBookCount = $bookCards$.length;
    const handler = getStorageHandler(window, $storageSource$, '');
    const { error, deleted } = await handler.deleteBookData(
      $bookCards$.reduce((toDelete, card) => {
        if (bookIds.includes(card.id)) {
          toDelete.push(card.title);
        }
        return toDelete;
      }, [] as string[]),
      cancelSignal,
      $keepLocalStatisticsOnDeletion$
    );

    resetProgress();

    await tick();

    if (deleted.length === currentBookCount) {
      selectMode = false;
    } else {
      selectedBookIds = cloneMutateSet(selectedBookIds, (set) => {
        deleted.forEach((deletedBookId) => set.delete(deletedBookId));
      });
    }

    if (error) {
      showError('Deletion failed', error, 'Error(s) occurred during deletion');
    }
  }

  async function onImportBackup(file: File) {
    if (!operationAllowed()) {
      return;
    }

    const errorTitle = 'Import failed';

    cancelTooltip = `Cancels the current Import\nAlready imported data will not be deleted`;

    initializeReplicationProgressData();

    if (!file.name.endsWith('.zip')) {
      resetProgress();

      showError(errorTitle, 'Invalid file - expected zip archive', '');
      return;
    }

    const error = await importBackup(
      getStorageHandler(
        window,
        StorageKey.BACKUP,
        undefined,
        $storageSource$ === StorageKey.BROWSER,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      ),
      getStorageHandler(
        window,
        $storageSource$,
        '',
        $storageSource$ === StorageKey.BROWSER,
        $cacheStorageData$,
        $replicationSaveBehavior$,
        $statisticsMergeMode$,
        $readingGoalsMergeMode$
      ),
      file,
      cancelSignal
    ).catch((err) => err.message);

    resetProgress();

    if (error) {
      showError(errorTitle, error, 'Error(s) occurred during import');
    }
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

  function onBugReportClick() {
    dialogManager.dialogs$.next([
      {
        component: LogReportDialog,
        props: {
          title: 'Bug Report',
          message: 'Please include the attached file for your report'
        }
      }
    ]);
  }

  function onDifficultyClick() {
    const selectedIds = ($bookCards$ ?? [])
      .filter((card) => selectedBookIds.has(card.id) && card.calibreId)
      .map((card) => card.calibreId as number);

    dialogManager.dialogs$.next([{ component: DifficultyDialog, props: { selectedIds } }]);
  }

  function onReplicateData() {
    dialogManager.dialogs$.next([{ component: BookExportDialog, disableCloseOnClick: true }]);
  }

  async function onDeleteStatistics() {
    const titles = $bookCards$
      .filter((card) => selectedBookIds.has(card.id))
      .map((book) => book.title);

    let wasCanceled = false;

    if ($confirmStatisticsDeletion$) {
      wasCanceled = await new Promise((resolver) => {
        dialogManager.dialogs$.next([
          {
            component: ConfirmDialog,
            props: {
              dialogHeader: 'Delete Data',
              dialogMessage: `This will delete all Statistics for the selected ${pluralize(
                titles.length,
                'Title',
                false
              )} (which may include start and/or completion Data)\n\nExecute a one time Sync with an export behavior of "replace" and/or statistics merge mode of "replace" to apply deletions to other devices`,
              contentStyles: 'white-space: pre-line;',
              resolver
            }
          }
        ]);
      });
    }

    if (wasCanceled) {
      return;
    }

    cancelTooltip = `Cancels the current Process`;

    initializeReplicationProgressData();

    const limiter = pLimit(1);
    const tasks: Promise<void>[] = [];

    let failed = 0;

    replicationProgress$.next({ progressBase: 1, maxProgress: titles.length });

    titles.forEach((title) => {
      tasks.push(
        limiter(async () => {
          try {
            throwIfAborted(cancelSignal);
            await database.deleteStatisticEntries([title], true);

            replicationProgress$.next({ progressToAdd: 1 });
          } catch (error) {
            handleErrorDuringReplication(error, `Error on deleting statistics for ${title}: `, [
              limiter
            ]);

            failed += 1;
          }
        })
      );
    });

    await Promise.all(tasks).catch(() => {});

    resetProgress();

    if (failed) {
      const errorMessage = `Unable to delete statistics of ${pluralize(failed, 'Title')}`;

      showError('Deletion Failed', errorMessage, errorMessage);
    }
  }

  async function onClearProgress() {
    const titles = $bookCards$
      .filter((card) => selectedBookIds.has(card.id))
      .map((book) => book.title);
    const wasCanceled = await new Promise<boolean>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: ConfirmDialog,
          props: {
            dialogHeader: 'Clear Progress',
            dialogMessage: `Start ${pluralize(titles.length, 'Title', false)} from the beginning?\n\nThe reading position is reset on all devices. Statistics and highlights are kept.`,
            contentStyles: 'white-space: pre-line;',
            resolver
          }
        }
      ]);
    });

    if (wasCanceled || !operationAllowed()) {
      return;
    }

    cancelTooltip = `Cancels the current Process\nAlready reset books stay reset`;

    initializeReplicationProgressData();
    replicationProgress$.next({ progressBase: 1, maxProgress: titles.length });

    const handler = getStorageHandler(window, $storageSource$, '');
    const failedTitles: string[] = [];

    for (const title of titles) {
      if (cancelSignal.aborted) {
        break;
      }

      try {
        await clearReadingProgress(handler, title);
      } catch (error: any) {
        logger.error(`Error clearing progress of ${title}: ${error.message}`);
        failedTitles.push(title);
      }

      replicationProgress$.next({ progressToAdd: 1 });
    }

    database.dataListChanged$.next(handler);
    resetProgress();

    if (failedTitles.length) {
      const errorMessage = `Unable to clear progress of ${pluralize(failedTitles.length, 'Title')}`;

      showError('Clear Progress Failed', errorMessage, errorMessage);
    }
  }

  function updateProgress(replicationProgressData: ReplicationProgress) {
    if (cancelSignal.aborted) {
      return;
    }

    progressBase = replicationProgressData.progressBase || progressBase || 0;
    replicationToProgress = replicationProgressData.maxProgress || replicationToProgress || 0;

    if (replicationProgressData.skipStep) {
      const progressDiffToAdd =
        Math.ceil(replicationProgress / progressBase) * progressBase - replicationProgress;

      replicationProgress =
        Math.floor(
          (replicationProgress + (progressDiffToAdd || progressBase) + Number.EPSILON) * 1000
        ) / 1000;
    } else if (replicationProgressData.completeStep) {
      const progressDiffToAdd = Math.ceil(replicationProgress) - replicationProgress;

      replicationProgress =
        Math.floor((replicationProgress + progressDiffToAdd + Number.EPSILON) * 1000) / 1000;
    } else if (replicationProgressData.progressToAdd && replicationProgressData.progressToAdd > 0) {
      replicationProgress =
        Math.floor(
          (replicationProgress + replicationProgressData.progressToAdd + Number.EPSILON) * 1000
        ) / 1000;
    }

    if (replicationProgressData.progressToAdd) {
      const duration = (Date.now() - executionStart) / 1000;
      const processPerSecond = replicationProgress / duration;
      const remainingTime = (replicationToProgress - replicationProgress) / processPerSecond;

      replicationProgressRemaining =
        replicationToProgress > replicationProgress
          ? `~ ${getTimestamp(Math.ceil(remainingTime))}`
          : '~ 00:00:01';
    }
  }

  const replicator$ = executeReplicate$.pipe(
    switchMap(async () => {
      if (!operationAllowed()) {
        return;
      }

      cancelTooltip = 'Cancels the current export';

      initializeReplicationProgressData();

      const handlers = [$storageSource$, $lastExportedTarget$].map((storageType) =>
        getStorageHandler(
          window,
          storageType,
          '',
          $lastExportedTarget$ === StorageKey.BROWSER,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        )
      );
      const books = $bookCards$.filter((card) => selectedBookIds.has(card.id));
      const error = await replicateData(
        handlers[0],
        handlers[1],
        false,
        books.map((book) => ({ title: book.title, imagePath: book.imagePath })),
        $lastExportedTypes$,
        cancelSignal
      ).catch((err) => err.message);

      resetProgress();

      if (error) {
        showError('Export failed', error, 'Error(s) occurred during export');
      }
    }),
    reduceToEmptyString()
  );

  function getTimestamp(seconds: number) {
    return seconds && Number.isFinite(seconds)
      ? new Date(seconds * 1000).toISOString().substr(11, 8)
      : '??:??:??';
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Book Manager')}</title>
</svelte:head>

{$replicator$ ?? ''}

<div class="app-page-shell">
  <BookManagerHeader
    currentBookId={$currentBookId$}
    hasBooks={!!$bookCards$?.length}
    disabled={!!replicationToProgress}
    bind:selectMode
    on:filesChange={(ev) => onFilesChange(ev.detail)}
    on:domainHintClick={onDomainHintClick}
    on:bugReportClick={onBugReportClick}
    on:importBackup={(ev) => onImportBackup(ev.detail)}
  />

  <div class="library-layout" class:library-layout-home={isHome}>
    {#if !isHome}
      <LibrarySidebar
        bookCards={$bookCards$ ?? []}
        loading={isLoading}
        bind:activeFilter
        bind:searchTerm
      />
    {/if}

    <main
      class="library-main"
      aria-label="Book library"
      on:dragenter={(ev) => ev.preventDefault()}
      on:dragover={(ev) => ev.preventDefault()}
      on:dragend={(ev) => ev.preventDefault()}
      on:drop={(ev) => ev.preventDefault()}
      on:drop={(ev) => getDropEventFiles(ev).then(onFilesChange)}
    >
      <div class="library-tabs" role="tablist" aria-label="Library">
        <button
          type="button"
          role="tab"
          class="library-tab"
          class:library-tab-active={isHome}
          aria-selected={isHome}
          on:click={() => ($libraryTab$ = 'home')}
        >
          <Fa icon={faHouse} /> Home
        </button>
        <button
          type="button"
          role="tab"
          class="library-tab"
          class:library-tab-active={!isHome}
          aria-selected={!isHome}
          on:click={() => ($libraryTab$ = 'store')}
        >
          <Fa icon={faStore} /> Store
          {#if $bookCards$?.length}<span class="library-tab-count">{$bookCards$.length}</span>{/if}
        </button>
      </div>
      {#if !isHome}
        <div class="library-tabs library-tabs-small" role="radiogroup" aria-label="Store view">
          <button
            type="button"
            role="radio"
            class="library-tab"
            class:library-tab-active={!showSeriesGrid}
            aria-checked={!showSeriesGrid}
            on:click={() => setStoreView('books')}
          >
            <Fa icon={faBook} /> Books
          </button>
          <button
            type="button"
            role="radio"
            class="library-tab"
            class:library-tab-active={showSeriesGrid}
            aria-checked={showSeriesGrid}
            on:click={() => setStoreView('series')}
          >
            <Fa icon={faLayerGroup} /> Series
          </button>
        </div>
      {/if}
      {#if replicationToProgress}
        <div class="library-toolbar app-surface-card" role="status">
          <button
            type="button"
            class="library-toolbar-button"
            title={cancelTooltip}
            aria-label="Cancel operation"
            on:click={() => {
              if (!cancelSignal.aborted) {
                cancelToken.abort();
                replicationProgressRemaining = 'Canceling ...';
              }
            }}
          >
            <Fa icon={faCircleXmark} />
          </button>
          <progress
            class="library-progress"
            value={replicationProgress}
            max={replicationToProgress}
          />
          <span class="shrink-0 text-sm font-bold tabular-nums">
            {replicationProgressRemaining}
          </span>
        </div>
      {:else if selectMode}
        <div class="library-toolbar app-surface-card">
          <span class="mr-auto text-sm font-extrabold">
            {selectedBookIds.size} selected
          </span>
          <button
            type="button"
            class="library-toolbar-button"
            title="Select all shown books"
            on:click={onSelectAllBooks}
          >
            <Fa icon={faCheckDouble} />
            <span class="hidden sm:inline">Select all</span>
          </button>
          <button
            type="button"
            class="library-toolbar-button"
            title="Read the selected book"
            disabled={selectedBookIds.size !== 1}
            on:click={readSelected}
          >
            <Fa icon={faBookOpen} />
            <span class="hidden sm:inline">Read</span>
          </button>
          <button
            type="button"
            class="library-toolbar-button"
            title="Add selected books to Home"
            disabled={!selectedBookIds.size}
            on:click={addSelectedToHome}
          >
            <Fa icon={faPlus} />
            <span class="hidden sm:inline">Add to Home</span>
          </button>
          <button
            type="button"
            class="library-toolbar-button"
            title="Open export menu"
            disabled={!selectedBookIds.size}
            on:click={onReplicateData}
          >
            <Fa icon={faCloudArrowUp} />
            <span class="hidden sm:inline">Export</span>
          </button>
          {#if $storageSource$ === StorageKey.BROWSER}
            <button
              type="button"
              class="library-toolbar-button"
              title="Show statistics for selected books"
              disabled={!selectedBookIds.size}
              on:click={onSelectionToStatistics}
            >
              <Fa icon={faChartLine} />
            </button>
            <button
              type="button"
              class="library-toolbar-button"
              title="Delete statistics for selected books"
              disabled={!selectedBookIds.size}
              on:click={onDeleteStatistics}
            >
              <Fa icon={faCalendarXmark} />
            </button>
          {/if}
          {#if $storageSource$ === StorageKey.CALIBRE && hasPermission($account$, 'series')}
            <button
              type="button"
              class="library-toolbar-button"
              title="Make a series from the selected book and the books like it"
              disabled={selectedBookIds.size !== 1}
              on:click={onMakeSeries}
            >
              <Fa icon={faLayerGroup} />
              <span class="hidden sm:inline">Make series</span>
            </button>
          {/if}
          {#if $storageSource$ === StorageKey.CALIBRE && hasPermission($account$, 'difficulty')}
            <button
              type="button"
              class="library-toolbar-button"
              title="Estimate difficulty of selected books"
              disabled={!selectedBookIds.size}
              on:click={onDifficultyClick}
            >
              <Fa icon={faGaugeHigh} />
            </button>
          {/if}
          {#if $storageSource$ !== StorageKey.FS}
            <button
              type="button"
              class="library-toolbar-button"
              title="Clear reading progress of selected books"
              disabled={!selectedBookIds.size}
              on:click={onClearProgress}
            >
              <Fa icon={faRotateLeft} />
              <span class="hidden sm:inline">Clear progress</span>
            </button>
          {/if}
          <button
            type="button"
            class="library-toolbar-button library-toolbar-button-danger"
            title="Delete selected books"
            disabled={!selectedBookIds.size}
            on:click={() => removeBooks(Array.from(selectedBookIds))}
          >
            <Fa icon={faTrash} />
          </button>
          <button
            type="button"
            class="library-toolbar-button"
            title="Stop selecting"
            aria-label="Stop selecting"
            on:click={() => (selectMode = false)}
          >
            <Fa icon={faXmark} />
          </button>
        </div>
      {/if}

      {#if isLoading}
        <LibrarySkeleton mode={$libraryDisplayMode$} />
      {:else if $bookCards$.length && isHome}
        <LearnerDashboard />
        <ContinueReadingShelf
          bookCards={$bookCards$}
          currentBookId={$currentBookId$}
          on:bookClick={(ev) => onBookClick(ev.detail.id)}
          on:bookSelect={(ev) => selectBook(ev.detail.id)}
        />
        <ContinueReadingShelf
          bookCards={$bookCards$}
          shelfBooks={homeCards}
          heading="My books"
          icon={faHouse}
          removeTitle="Remove from Home"
          currentBookId={$currentBookId$}
          on:bookClick={(ev) => onBookClick(ev.detail.id)}
          on:bookSelect={(ev) => selectBook(ev.detail.id)}
          on:remove={(ev) => removeFromHome(ev.detail.title)}
        />
        {#if !homeCards.length}
          <div class="library-empty app-surface-card">
            <p class="font-bold">Pick your next reads in the Store</p>
            <p class="text-sm font-semibold text-[color:var(--app-muted-fg)]">
              Search for a book or a series there and add it to Home, or select several books and
              press "Add to Home".
            </p>
            <button
              type="button"
              class="library-toolbar-button"
              on:click={() => ($libraryTab$ = 'store')}
            >
              <Fa icon={faStore} /> Open the Store
            </button>
          </div>
        {/if}
      {:else if $bookCards$.length && showSeriesGrid}
        <SeriesGrid
          groups={seriesGroups(visibleBookCards)}
          on:showSeries={(ev) => showSeries(ev.detail)}
        />
      {:else if $bookCards$.length}
        <SeriesResults matches={seriesMatches} on:showSeries={(ev) => showSeries(ev.detail)} />
        {#if !visibleBookCards.length}
          <div class="library-empty app-surface-card">
            <p class="font-bold">No books match this filter.</p>
            <button type="button" class="library-toolbar-button" on:click={clearFilters}>
              Show all books
            </button>
          </div>
        {:else if $libraryDisplayMode$ === 'list'}
          <BookCardTable
            currentBookId={$currentBookId$}
            {selectedBookIds}
            {selectMode}
            sortOption={$booklistSortOptions$[$storageSource$]}
            bookCards={renderedBookCards}
            on:bookClick={(ev) => onStoreBookClick(ev.detail.id)}
            on:removeBookClick={(ev) => removeBooks([ev.detail.id])}
            on:sort={(ev) => onSortChange(ev.detail)}
          />
        {:else}
          <BookCardList
            currentBookId={$currentBookId$}
            {selectedBookIds}
            {selectMode}
            compact={$libraryDisplayMode$ === 'covers-compact'}
            bookCards={renderedBookCards}
            on:bookClick={(ev) => onStoreBookClick(ev.detail.id)}
            on:removeBookClick={(ev) => removeBooks([ev.detail.id])}
          />
        {/if}
        {#if renderedBookCards.length < visibleBookCards.length}
          {#key renderLimit}
            <div class="flex justify-center pb-4" use:renderMoreOnVisible>
              <button
                type="button"
                class="library-toolbar-button"
                on:click={() => (renderLimit += renderStep)}
              >
                Show more ({visibleBookCards.length - renderedBookCards.length} remaining)
              </button>
            </div>
          {/key}
        {/if}
        {#if hasActiveFilter && visibleBookCards.length}
          <p class="pb-4 text-center text-xs font-semibold text-[color:var(--app-muted-fg)]">
            Showing {visibleBookCards.length} of {$bookCards$.length} books ·
            <button type="button" class="underline" on:click={clearFilters}>show all</button>
          </p>
        {/if}
      {:else}
        <label class="library-empty library-empty-import app-surface-card">
          <input
            type="file"
            accept="application/epub+zip,.epub,.htmlz,plain/text,.txt,.cbz,.zip"
            multiple
            hidden
            use:inputFile={onFilesChange}
          />
          <span class="library-empty-icon"><Fa icon={faFileImport} /></span>
          <span class="text-xl font-extrabold">Your library is empty</span>
          <span class="text-sm font-semibold text-[color:var(--app-muted-fg)]">
            Drop EPUB, HTMLZ or TXT files here, or click to import
          </span>
        </label>
      {/if}
    </main>
  </div>
</div>

<style>
  .library-layout {
    --library-header-height: 4rem;
    --library-sidebar-width: 275px;

    display: grid;
    grid-template-columns: var(--library-sidebar-width) minmax(0, 1fr);
    gap: 1.35rem;
    padding-top: 4.65rem;
    padding-right: clamp(1rem, 3.125vw, 2.5rem);
    padding-bottom: 3rem;
  }

  @media (min-width: 1280px) {
    .library-layout {
      --library-header-height: 3.25rem;

      padding-top: 4.25rem;
    }
  }

  .library-layout-home {
    grid-template-columns: minmax(0, 1fr);
    padding-left: clamp(1rem, 3.125vw, 2.5rem);
  }

  .library-layout-home .library-main {
    grid-column: auto;
  }

  .library-tabs {
    display: inline-flex;
    gap: 0.25rem;
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-color) 92%, transparent);
  }

  .library-tabs-small {
    margin-left: 0.5rem;
  }

  .library-tabs-small .library-tab {
    padding: 0.3rem 0.8rem;
    font-size: 0.8rem;
  }

  .library-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    color: var(--app-muted-fg);
    font-size: 0.88rem;
    font-weight: 800;
  }

  .library-tab-active {
    background: color-mix(in srgb, var(--accent-color) 18%, var(--surface-strong-color));
    color: var(--font-color);
  }

  .library-tab-count {
    font-size: 0.72rem;
    font-weight: 700;
    opacity: 0.75;
  }

  .library-main {
    grid-column: 2;
    min-width: 0;
    min-height: calc(100dvh - 8rem);
    padding-top: 0.25rem;
  }

  @media (max-width: 900px) {
    .library-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      padding-inline: 1rem;
    }

    .library-main {
      grid-column: auto;
    }
  }

  .library-toolbar {
    position: sticky;
    top: calc(var(--library-header-height) + 0.5rem);
    z-index: 15;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    border-radius: 1.15rem;
  }

  .library-toolbar-button {
    display: inline-flex;
    min-height: 2.4rem;
    min-width: 2.4rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 0.8rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 10%, var(--border-color));
    border-radius: 0.85rem;
    background: color-mix(in srgb, var(--surface-color) 92%, transparent);
    font-size: 0.85rem;
    font-weight: 700;
    transition:
      background-color 0.16s ease,
      border-color 0.16s ease;
  }

  .library-toolbar-button:hover:not(:disabled),
  .library-toolbar-button:focus-visible {
    border-color: color-mix(in srgb, var(--accent-color) 38%, var(--border-color));
    background: color-mix(in srgb, var(--accent-color) 10%, var(--surface-strong-color));
    outline: none;
  }

  .library-toolbar-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .library-toolbar-button-danger:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--app-danger-color) 42%, var(--border-color));
    background: color-mix(in srgb, var(--app-danger-color) 12%, var(--surface-strong-color));
    color: var(--app-danger-color);
  }

  .library-progress {
    flex: 1 1 auto;
    height: 0.6rem;
    overflow: hidden;
    border-radius: 999px;
    appearance: none;
    background: color-mix(in srgb, var(--font-color) 12%, var(--surface-color));
  }

  .library-progress::-webkit-progress-bar {
    background: transparent;
  }

  .library-progress::-webkit-progress-value {
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent-color), var(--accent-strong-color));
  }

  .library-progress::-moz-progress-bar {
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent-color), var(--accent-strong-color));
  }

  .library-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    margin: 3rem auto;
    max-width: 32rem;
    padding: 2.5rem 1.5rem;
    border-radius: 1.4rem;
    text-align: center;
  }

  .library-empty-import {
    cursor: pointer;
    border-style: dashed;
    border-color: color-mix(in srgb, var(--accent-color) 30%, var(--border-color));
  }

  .library-empty-icon {
    display: inline-flex;
    width: 3.5rem;
    height: 3.5rem;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--accent-color) 22%, var(--border-color));
    border-radius: 1rem;
    background: color-mix(in srgb, var(--accent-color) 14%, var(--surface-strong-color));
    color: var(--accent-strong-color);
    font-size: 1.4rem;
  }
</style>
