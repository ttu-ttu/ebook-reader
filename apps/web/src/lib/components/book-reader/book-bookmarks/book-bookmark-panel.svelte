<script lang="ts">
  import { faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { isTrackerPaused$ } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import { skipKeyDownListener$, statisticsEnabled$ } from '$lib/data/store';
  import { createEventDispatcher, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import BookBookmarkItem from './book-bookmark-item.svelte';
  import { bookmarkPanelIsOpen$ } from './book-bookmark-panel';
  import type { BooksDbUserBookmarkData } from './bookmark-types';

  export let bookmarks: BooksDbUserBookmarkData[] = [];
  export let currentExploredCharCount: number = 0;
  export let wasTrackerPaused: boolean;

  let activeTab: 'bookmarks' | 'autosaves' = 'autosaves';
  let bookmarkFilter = '';

  $: manualBookmarks = bookmarks.filter((b) => !b.isAutosave);
  $: filteredManualBookmarks = bookmarkFilter
    ? manualBookmarks.filter(
        (b) =>
          b.label.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
          b.note?.toLowerCase().includes(bookmarkFilter.toLowerCase())
      )
    : manualBookmarks;
  $: autosaves = bookmarks.filter((b) => b.isAutosave).sort((a, b) => b.createdAt - a.createdAt);

  const dispatch = createEventDispatcher<{
    select: BooksDbUserBookmarkData;
    edit: BooksDbUserBookmarkData;
    delete: BooksDbUserBookmarkData;
    promote: BooksDbUserBookmarkData;
    clearAutosaves: void;
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

  function handlePromote(bookmark: BooksDbUserBookmarkData) {
    dispatch('promote', bookmark);
  }

  function handleClearAutosaves() {
    dispatch('clearAutosaves');
  }

  function handleCreate() {
    closePanel();
    dispatch('create');
  }
</script>

<div class="flex h-full w-full flex-col">
  <!-- Header with Segmented Tabs -->
  <div
    class="flex items-center justify-between border-b border-gray-700/20 px-4 py-3 dark:border-gray-300/20"
  >
    <div class="flex items-center gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/10">
      <button
        type="button"
        class="rounded-md px-3 py-1 text-sm font-medium transition-all {activeTab === 'autosaves'
          ? 'bg-white text-black shadow dark:bg-gray-800 dark:text-white'
          : 'opacity-60 hover:opacity-100'}"
        on:click={() => (activeTab = 'autosaves')}
      >
        Autosaves ({autosaves.length})
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1 text-sm font-medium transition-all {activeTab === 'bookmarks'
          ? 'bg-white text-black shadow dark:bg-gray-800 dark:text-white'
          : 'opacity-60 hover:opacity-100'}"
        on:click={() => (activeTab = 'bookmarks')}
      >
        Bookmarks ({manualBookmarks.length})
      </button>
    </div>
    <button
      type="button"
      class="rounded p-1.5 opacity-60 hover:opacity-100 focus:outline-none"
      title="Close"
      on:click={closePanel}
    >
      <Fa icon={faXmark} />
    </button>
  </div>

  {#if activeTab === 'autosaves'}
    <!-- Autosaves Header Bar -->
    <div
      class="flex items-center justify-between border-b border-gray-700/10 px-4 py-2 text-xs opacity-75 dark:border-gray-300/10"
    >
      <span>Recent checkpoints. Click any to restore your position.</span>
      {#if autosaves.length > 0}
        <button
          type="button"
          class="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-500/10 focus:outline-none"
          title="Clear all autosaves"
          on:click={handleClearAutosaves}
        >
          <Fa icon={faTrash} />
          <span>Clear All</span>
        </button>
      {/if}
    </div>

    <!-- Autosaves List / Empty State -->
    <div class="flex-1 overflow-y-auto overscroll-contain pb-8">
      {#if autosaves.length === 0}
        <div class="flex h-48 flex-col items-center justify-center p-6 text-center opacity-60">
          <p class="text-sm">No autosaves recorded yet.</p>
          <p class="mt-1 text-xs">
            Checkpoints will automatically appear here every few seconds as you read.
          </p>
        </div>
      {:else}
        {#each autosaves as bookmark (bookmark.id ?? bookmark.createdAt)}
          <BookBookmarkItem
            {bookmark}
            isCurrentPosition={Math.abs(bookmark.exploredCharCount - currentExploredCharCount) < 50}
            on:select={(e) => handleSelect(e.detail)}
            on:promote={(e) => handlePromote(e.detail)}
            on:delete={(e) => handleDelete(e.detail)}
          />
        {/each}
      {/if}
    </div>
  {:else}
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

    <!-- Filter input for long bookmark lists -->
    {#if manualBookmarks.length > 5}
      <div class="border-b border-gray-700/10 px-3 py-2 dark:border-gray-300/10">
        <input
          type="text"
          placeholder="Filter bookmarks by title or note..."
          class="w-full rounded border border-gray-700/10 bg-black/5 px-2.5 py-1 text-xs outline-none transition-all placeholder:opacity-50 focus:border-blue-500 focus:bg-black/10 dark:border-gray-300/10 dark:bg-white/10 dark:focus:bg-white/15"
          bind:value={bookmarkFilter}
        />
      </div>
    {/if}

    <!-- Permanent Bookmarks List / Empty State -->
    <div class="flex-1 overflow-y-auto overscroll-contain pb-8">
      {#if manualBookmarks.length === 0}
        <div class="flex h-48 flex-col items-center justify-center p-6 text-center opacity-60">
          <p class="text-sm">No bookmarks yet.</p>
          <p class="mt-1 text-xs">
            Click "+ Add Bookmark" above or press Shift+B to bookmark this location.
          </p>
        </div>
      {:else if filteredManualBookmarks.length === 0}
        <div class="flex h-32 flex-col items-center justify-center p-6 text-center opacity-60">
          <p class="text-xs">No bookmarks match "{bookmarkFilter}".</p>
        </div>
      {:else}
        {#each filteredManualBookmarks as bookmark (bookmark.id ?? bookmark.createdAt)}
          <BookBookmarkItem
            {bookmark}
            isCurrentPosition={Math.abs(bookmark.exploredCharCount - currentExploredCharCount) < 50}
            on:select={(e) => handleSelect(e.detail)}
            on:edit={(e) => handleEdit(e.detail)}
            on:delete={(e) => handleDelete(e.detail)}
          />
        {/each}
      {/if}
    </div>
  {/if}
</div>
