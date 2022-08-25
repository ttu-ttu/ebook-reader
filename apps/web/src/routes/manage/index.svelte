<script lang="ts">
  import { goto } from '$app/navigation';
  import { faUpload } from '@fortawesome/free-solid-svg-icons';
  import BookCardList from '$lib/components/book-card/book-card-list.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import BookManagerHeader from '$lib/components/book-card/book-manager-header.svelte';
  import LogReportDialog from '$lib/components/log-report-dialog.svelte';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import { pxScreen } from '$lib/css-classes';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { logger } from '$lib/data/logger';
  import { getStorageHandler } from '$lib/data/storage-manager/storage-manager-factory';
  import { StorageKey } from '$lib/data/storage-manager/storage-source';
  import { database, requestPersistentStorage$ } from '$lib/data/store';
  import { storage } from '$lib/data/window/navigator/storage';
  import { cloneMutateSet } from '$lib/functions/clone-mutate-set';
  import { getDropEventFiles } from '$lib/functions/file-dom/get-drop-event-files';
  import { inputFile } from '$lib/functions/file-dom/input-file';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { keyBy } from '$lib/functions/key-by';
  import { addBooks } from '$lib/functions/replication/import-replication';
  import { replicationProgress$ } from '$lib/functions/replication/replication-progress';
  import { combineLatest, map, Observable, share, Subject, takeUntil } from 'rxjs';
  import { onDestroy, tick } from 'svelte';
  import Fa from 'svelte-fa';

  const destroy$ = new Subject<void>();

  const booksAreLoading$ = database.listLoading$.pipe(map((isLoading) => isLoading));

  const bookCards$: Observable<BookCardProps[]> = combineLatest([
    database.dataList$,
    database.bookmarks$
  ]).pipe(
    map(([dataList, bookmarks]) => {
      const bookmarkMap = keyBy(bookmarks, 'dataId');

      return dataList
        .map((d) => ({
          ...d,
          ...bookmarkToProgress(bookmarkMap.get(d.id))
        }))
        .sort(sortBookCards);
    }),
    share()
  );

  const currentBookId$ = database.lastItem$.pipe(
    map((item) => item?.dataId),
    share()
  );

  let selectedBookIds: ReadonlySet<number> = new Set();
  let selectMode = false;
  let cancelToken = new AbortController();
  let cancelSignal = cancelToken.signal;
  let cancelTooltip = '';
  let replicationProgress = 0;
  let replicationToProgress = 0;
  let replicationProgressRemaining = '~ ??:??:??';
  let baseProgress = 0;
  let executionStart: number;

  $: {
    if (!selectMode) {
      selectedBookIds = new Set();
    }
  }

  onDestroy(() => {
    destroy$.next();
    destroy$.complete();
  });

  function bookmarkToProgress(b: BooksDbBookmarkData | undefined) {
    return b?.progress
      ? {
          progress: typeof b.progress === 'string' ? +b.progress.slice(0, -1) : b.progress,
          lastBookmarkModified: b.lastBookmarkModified || 0
        }
      : { progress: 0, lastBookmarkModified: 0 };
  }

  function sortBookCards(card1: BookCardProps, card2: BookCardProps) {
    let sortDiff = 0;

    const { lastBookModified: card1LastModified = 0, lastBookOpen: card1lastOpen = 0 } = card1;
    const { lastBookModified: card2LastModified = 0, lastBookOpen: card2lastOpen = 0 } = card2;

    if (card1lastOpen || card2lastOpen) {
      sortDiff = card2lastOpen - card1lastOpen;
    } else {
      sortDiff = card2LastModified - card1LastModified;
    }

    return sortDiff;
  }

  function onBookClick(bookId: number) {
    if (!operationAllowed()) {
      return;
    }

    if (!selectMode) {
      openBook(bookId);
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

  function operationAllowed() {
    return !replicationToProgress;
  }

  function openBook(bookId: number) {
    if (!bookId) {
      return;
    }

    database.putLastItem(bookId);
    gotoBook(bookId);
  }

  async function gotoBook(id: number) {
    await goto(`/b?id=${id}`);
  }

  async function onFilesChange(fileList: FileList | File[]) {
    if (!operationAllowed()) {
      return;
    }

    cancelTooltip = `Cancels the current Import\nAlready imported Data will not be deleted`;

    initializeReplicationProgressData();

    const supportedExtRegex = /\.(?:htmlz|epub)$/;
    const files = Array.from(fileList).filter((f) => supportedExtRegex.test(f.name));

    if (!files.length) {
      resetProgress();

      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Bookimport failed',
            message: 'File(s) must be HTMLZ or EPUB'
          }
        }
      ]);
      return;
    }

    if (requestPersistentStorage$.getValue()) {
      try {
        await storage.persist();
      } catch (_) {
        // no-op
      }
    }

    const { error, dataId } = await addBooks(files, window, document, cancelSignal).catch(
      (catchedError) => ({ error: catchedError.message, dataId: 0 })
    );

    resetProgress();

    if (error) {
      const showReport = logger.history.length > 1;

      dialogManager.dialogs$.next([
        {
          component: showReport ? LogReportDialog : MessageDialog,
          props: {
            title: 'Bookimport failed',
            message: showReport ? 'Error(s) occurred during Bookimport' : error
          }
        }
      ]);
    } else if (dataId) {
      openBook(dataId);
    }
  }

  function initializeReplicationProgressData() {
    replicationProgressRemaining = '~ ??:??:??';
    replicationProgress = 0;
    replicationToProgress = 1;
    executionStart = Date.now();

    logger.clearHistory();

    cancelToken = new AbortController();
    cancelSignal = cancelToken.signal;
  }

  function resetProgress() {
    replicationToProgress = 0;
    replicationProgress = 0;
    cancelTooltip = '';
  }

  function onSelectAllBooks() {
    const bookCards = $bookCards$;
    selectedBookIds = cloneMutateSet(selectedBookIds, (set) => {
      bookCards.forEach((x) => set.add(x.id));
    });
  }

  function backToCurrentBook() {
    const currentBookId = $currentBookId$;
    if (!currentBookId) return;
    gotoBook(currentBookId);
  }

  async function removeBooks(bookIds: number[]) {
    if (!operationAllowed()) {
      return;
    }

    cancelTooltip = `Cancels the Deletion\nAlready deleted Data will not be restored`;

    initializeReplicationProgressData();

    const currentBookCount = $bookCards$.length;
    const handler = await getStorageHandler(StorageKey.BROWSER, window);
    const [error, deletedBooks] = (await handler.deleteBookData(
      $bookCards$.reduce((toDelete, card) => {
        if (bookIds.includes(card.id)) {
          toDelete.push(card.title);
        }
        return toDelete;
      }, [] as string[]),
      cancelSignal
    )) as [string, number[]];

    resetProgress();

    await tick();

    if (deletedBooks.length === currentBookCount) {
      selectMode = false;
    } else {
      selectedBookIds = cloneMutateSet(selectedBookIds, (set) => {
        deletedBooks.forEach((x) => set.delete(x));
      });
    }

    if (error) {
      const showReport = logger.history.length > 1;

      dialogManager.dialogs$.next([
        {
          component: showReport ? LogReportDialog : MessageDialog,
          props: {
            title: 'Deletion failed',
            message: showReport ? 'Error(s) occurred during Deletion' : error
          }
        }
      ]);
    }
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

  replicationProgress$.pipe(takeUntil(destroy$)).subscribe((replicationProgressData) => {
    if (cancelSignal.aborted) {
      return;
    }

    baseProgress = replicationProgressData.baseProgress || baseProgress || 0;
    replicationToProgress = replicationProgressData.maxProgress || replicationToProgress || 0;
    executionStart = replicationProgressData.executionStart || executionStart;

    if (replicationProgressData.progressToAdd === -1) {
      const progressDiffToAdd =
        Math.ceil(replicationProgress / baseProgress) * baseProgress - replicationProgress;
      replicationProgress += progressDiffToAdd || baseProgress;
    } else {
      replicationProgress += replicationProgressData.progressToAdd;
    }

    if (replicationProgressData.progressToAdd) {
      const duration = (Date.now() - executionStart) / 1000;
      const processPerSecond = replicationProgress / duration;
      const remainingTime = (replicationToProgress - replicationProgress) / processPerSecond;

      replicationProgressRemaining = `~ ${getTimestamp(Math.ceil(remainingTime))}`;
    }
  });

  function getTimestamp(seconds: number) {
    return seconds && Number.isFinite(seconds)
      ? new Date(seconds * 1000).toISOString().substr(11, 8)
      : '??:??:??';
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Book Manager')}</title>
</svelte:head>

<div class="elevation-4 fixed inset-x-0 top-0 z-10">
  <BookManagerHeader
    hasBookOpened={!!$currentBookId$}
    selectedCount={selectedBookIds.size}
    hasBooks={!!$bookCards$?.length}
    {cancelTooltip}
    {replicationProgress}
    {replicationToProgress}
    {replicationProgressRemaining}
    bind:selectMode
    on:selectAllClick={onSelectAllBooks}
    on:backToBookClick={backToCurrentBook}
    on:removeClick={() => removeBooks(Array.from(selectedBookIds))}
    on:filesChange={(ev) => onFilesChange(ev.detail)}
    on:bugReportClick={onBugReportClick}
    on:cancelReplication={() => {
      if (!cancelSignal.aborted) {
        cancelToken.abort();
        replicationProgressRemaining = 'Canceling ...';
      }
    }}
  />
</div>

<div
  class="{pxScreen} h-full pt-16 xl:pt-14"
  on:dragenter={(ev) => ev.preventDefault()}
  on:dragover={(ev) => ev.preventDefault()}
  on:dragend={(ev) => ev.preventDefault()}
  on:drop={(ev) => ev.preventDefault()}
  on:drop={(ev) => getDropEventFiles(ev).then(onFilesChange)}
>
  {#if !$bookCards$ || $booksAreLoading$}
    Loading...
  {:else if $bookCards$.length}
    <BookCardList
      currentBookId={$currentBookId$}
      {selectedBookIds}
      bookCards={$bookCards$}
      on:bookClick={(ev) => onBookClick(ev.detail.id)}
      on:removeBookClick={(ev) => removeBooks([ev.detail.id])}
    />
  {:else}
    <div class="flex justify-center pt-44 text-gray-400 text-opacity-40">
      <div class="flex w-3/6 justify-center xl:w-3/12">
        <Fa icon={faUpload} style="width: 100%; height: auto" />
      </div>
    </div>
    <label class="fixed inset-0 z-0">
      <input type="file" accept=".htmlz,.epub" multiple hidden use:inputFile={onFilesChange} />
    </label>
  {/if}
</div>
