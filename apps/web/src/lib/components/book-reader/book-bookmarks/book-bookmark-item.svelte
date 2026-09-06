<script lang="ts">
  import { faBookmark, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import { BOOKMARK_COLORS, type BooksDbUserBookmarkData } from './bookmark-types';

  export let bookmark: BooksDbUserBookmarkData;

  const dispatch = createEventDispatcher<{
    select: BooksDbUserBookmarkData;
    edit: BooksDbUserBookmarkData;
    delete: BooksDbUserBookmarkData;
  }>();

  function formatDate(timestamp: number) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function handleSelect() {
    dispatch('select', bookmark);
  }

  function handleEdit(evt: MouseEvent) {
    evt.stopPropagation();
    dispatch('edit', bookmark);
  }

  function handleDelete(evt: MouseEvent) {
    evt.stopPropagation();
    dispatch('delete', bookmark);
  }
</script>

<div
  tabindex="0"
  role="button"
  class="group flex cursor-pointer items-start justify-between gap-3 border-b border-gray-700/20 px-4 py-3 transition-colors hover:bg-black/5 dark:border-gray-300/20 dark:hover:bg-white/5"
  on:click={handleSelect}
  on:keydown={(e) => e.key === 'Enter' && handleSelect()}
>
  <div class="flex min-w-0 flex-1 items-start gap-3">
    <div class="mt-1 shrink-0 text-base" style:color={BOOKMARK_COLORS[bookmark.color] || '#3b82f6'}>
      <Fa icon={faBookmark} />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-base font-medium">
        {bookmark.label}
      </div>
      {#if bookmark.note}
        <div class="mt-0.5 line-clamp-2 text-xs opacity-75">
          {bookmark.note}
        </div>
      {/if}
      <div class="mt-1 flex items-center gap-2 text-xs opacity-60">
        <span>{Math.round(bookmark.progress * 100)}%</span>
        <span>•</span>
        <span>{formatDate(bookmark.createdAt)}</span>
      </div>
    </div>
  </div>

  <div class="flex shrink-0 items-center gap-1">
    <button
      type="button"
      class="rounded p-1.5 opacity-50 transition-opacity hover:text-blue-500 hover:opacity-100 focus:outline-none"
      title="Edit Bookmark"
      on:click={handleEdit}
    >
      <Fa icon={faPen} />
    </button>
    <button
      type="button"
      class="rounded p-1.5 opacity-50 transition-opacity hover:text-red-500 hover:opacity-100 focus:outline-none"
      title="Delete Bookmark"
      on:click={handleDelete}
    >
      <Fa icon={faTrash} />
    </button>
  </div>
</div>
