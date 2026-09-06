<script lang="ts">
  import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { isTrackerPaused$ } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import { skipKeyDownListener$, statisticsEnabled$ } from '$lib/data/store';
  import { createEventDispatcher, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import BookBookmarkItem from './book-bookmark-item.svelte';
  import { bookmarkPanelIsOpen$ } from './book-bookmark-panel';
  import type { BooksDbUserBookmarkData } from './bookmark-types';

  export let bookmarks: BooksDbUserBookmarkData[] = [];
  export let wasTrackerPaused: boolean;

  const dispatch = createEventDispatcher<{
    select: BooksDbUserBookmarkData;
    edit: BooksDbUserBookmarkData;
    delete: BooksDbUserBookmarkData;
    create: void;
  }>();

  onMount(() => {
    $skipKeyDownListener$ = true;
    dialogManager.dialogs$.next([
      {
        component: '<div/>'
      }
    ]);

    return () => {
      $skipKeyDownListener$ = false;
      dialogManager.dialogs$.next([]);
    };
  });

  function closePanel() {
    if ($statisticsEnabled$ && !wasTrackerPaused) {
      isTrackerPaused$.next(false);
    }
    bookmarkPanelIsOpen$.next(false);
    dialogManager.dialogs$.next([]);
  }

  function handleSelect(bookmark: BooksDbUserBookmarkData) {
    closePanel();
    dispatch('select', bookmark);
  }

  function handleEdit(bookmark: BooksDbUserBookmarkData) {
    dispatch('edit', bookmark);
  }

  function handleDelete(bookmark: BooksDbUserBookmarkData) {
    dispatch('delete', bookmark);
  }

  function handleCreate() {
    closePanel();
    dispatch('create');
  }
</script>

<div class="flex h-full w-full flex-col">
  <!-- Header -->
  <div
    class="flex items-center justify-between border-b border-gray-700/20 px-4 py-3 dark:border-gray-300/20"
  >
    <h2 class="text-lg font-bold">
      Bookmarks ({bookmarks.length})
    </h2>
    <button
      type="button"
      class="rounded p-1.5 opacity-60 hover:opacity-100 focus:outline-none"
      title="Close"
      on:click={closePanel}
    >
      <Fa icon={faXmark} />
    </button>
  </div>

  <!-- Add Bookmark button -->
  <div class="border-b border-gray-700/10 p-3 dark:border-gray-300/10">
    <button
      type="button"
      class="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none"
      on:click={handleCreate}
    >
      <Fa icon={faPlus} />
      <span>Add Bookmark at Current Position</span>
    </button>
  </div>

  <!-- List / Empty State -->
  <div class="flex-1 overflow-y-auto">
    {#if bookmarks.length === 0}
      <div class="flex h-48 flex-col items-center justify-center p-6 text-center opacity-60">
        <p class="text-sm">No bookmarks yet.</p>
        <p class="mt-1 text-xs">
          Click "+ Add Bookmark" above or press Shift+B to bookmark this location.
        </p>
      </div>
    {:else}
      {#each bookmarks as bookmark (bookmark.id ?? bookmark.createdAt)}
        <BookBookmarkItem
          {bookmark}
          on:select={(e) => handleSelect(e.detail)}
          on:edit={(e) => handleEdit(e.detail)}
          on:delete={(e) => handleDelete(e.detail)}
        />
      {/each}
    {/if}
  </div>
</div>
