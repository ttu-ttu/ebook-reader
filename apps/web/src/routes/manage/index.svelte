<script lang="ts">
  import Fa from 'svelte-fa';
  import { combineLatest, finalize, map, Observable, share } from 'rxjs';
  import { faUpload } from '@fortawesome/free-solid-svg-icons';
  import { goto } from '$app/navigation';
  import LogReportDialog from '$lib/components/log-report-dialog.svelte';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import BookManagerHeader from '$lib/components/book-card/book-manager-header.svelte';
  import BookCardList from '$lib/components/book-card/book-card-list.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
  import { pxScreen } from '$lib/css-classes';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { database, requestPersistentStorage$ } from '$lib/data/store';
  import { logger } from '$lib/data/logger';
  import { storage } from '$lib/data/window/navigator/storage';
  import { ErrorWithCode } from '$lib/functions/error-with-code';
  import { getDropEventFiles } from '$lib/functions/file-dom/get-drop-event-files';
  import { inputFile } from '$lib/functions/file-dom/input-file';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { cloneMutateSet } from '$lib/functions/clone-mutate-set';
  import { keyBy } from '$lib/functions/key-by';
  import { addFilesToDb } from './add-files-to-db';

  const bookCards$: Observable<BookCardProps[]> = combineLatest([
    database.dataList$,
    database.bookmarks$
  ]).pipe(
    map(([dataList, bookmarks]) => {
      const bookmarkMap = keyBy(bookmarks, 'dataId');
      const bookmarkToProgress = (b: BooksDbBookmarkData | undefined) => {
        if (!b?.progress) return 0;
        return typeof b.progress === 'string' ? +b.progress.slice(0, -1) : b.progress;
      };
      return dataList.map((d) => ({
        id: d.id,
        title: d.title,
        imagePath: d.coverImage || '',
        progress: bookmarkToProgress(bookmarkMap.get(d.id))
      }));
    }),
    share()
  );

  const currentBookId$ = database.lastItem$.pipe(
    map((item) => item?.dataId),
    share()
  );
  let isImporting = false;

  let selectedBookIds: ReadonlySet<number> = new Set();

  let selectMode = false;

  $: {
    if (!selectMode) {
      selectedBookIds = new Set();
    }
  }

  async function onFilesChange(fileList: FileList | File[]) {
    if (isImporting) return;

    isImporting = true;

    let hasError = false;

    addFilesToDb(fileList, requestPersistentStorage$.getValue(), storage, database, document)
      .pipe(finalize(() => (isImporting = false)))
      .subscribe({
        next: ({ progress, total }) => {
          if (progress.length === 1) {
            requestPersistentStorage$.next(false);
          }

          const [lastError] = progress[progress.length - 1];
          if (lastError) {
            logger.error(lastError);
            hasError = true;
          }

          if (progress.length !== total || total > 1) return;

          const [, dataId] = progress[0];
          if (dataId) {
            openBook(dataId);
          }
        },
        error: (err: unknown) => {
          logger.error(err);

          if (err instanceof ErrorWithCode) {
            dialogManager.dialogs$.next([
              {
                component: MessageDialog,
                props: {
                  title: 'Upload Failed',
                  message: err.message
                }
              }
            ]);
            return;
          }

          dialogManager.dialogs$.next([
            {
              component: LogReportDialog,
              props: {
                message: 'An error has occurred'
              }
            }
          ]);
        },
        complete: () => {
          if (!hasError) return;
          dialogManager.dialogs$.next([
            {
              component: LogReportDialog,
              props: {
                message: 'Failed to import some books'
              }
            }
          ]);
        }
      });
  }

  function onBookClick(bookId: number) {
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

  function openBook(bookId: number) {
    database.putLastItem(bookId);
    gotoBook(bookId);
  }

  async function removeBooks(bookIds: number[]) {
    await database.deleteData(bookIds);
    selectedBookIds = cloneMutateSet(selectedBookIds, (set) => {
      bookIds.forEach((x) => set.delete(x));
    });
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

  async function gotoBook(id: number) {
    await goto(`/b?id=${id}`);
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
</script>

<svelte:head>
  <title>{formatPageTitle('Book Manager')}</title>
</svelte:head>

<div class="elevation-4 fixed inset-x-0 top-0 z-10">
  <BookManagerHeader
    hasBookOpened={!!$currentBookId$}
    bind:selectMode
    selectedCount={selectedBookIds.size}
    {isImporting}
    on:selectAllClick={onSelectAllBooks}
    on:backToBookClick={backToCurrentBook}
    on:removeClick={() => removeBooks(Array.from(selectedBookIds))}
    on:filesChange={(ev) => onFilesChange(ev.detail)}
    on:bugReportClick={onBugReportClick}
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
  {#if !$bookCards$}
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
      <div class="flex justify-center w-3/6 xl:w-3/12">
        <Fa icon={faUpload} style="width: 100%; height: auto" />
      </div>
    </div>
    <label class="fixed z-0 inset-0">
      <input type="file" accept=".htmlz,.epub" multiple hidden use:inputFile={onFilesChange} />
    </label>
  {/if}
</div>
