<script lang="ts">
  import { faBookmark, faClock, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import { BOOKMARK_COLORS, type BooksDbUserBookmarkData } from './bookmark-types';

  export let bookmark: BooksDbUserBookmarkData;
  export let isCurrentPosition = false;

  const dispatch = createEventDispatcher<{
    select: BooksDbUserBookmarkData;
    edit: BooksDbUserBookmarkData;
    delete: BooksDbUserBookmarkData;
    promote: BooksDbUserBookmarkData;
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

  function formatRelativeTime(timestamp: number) {
    if (!timestamp) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(timestamp);
  }

  function handleSelect() {
    dispatch('select', bookmark);
  }

  function handleEdit(evt: MouseEvent) {
    evt.stopPropagation();
    dispatch('edit', bookmark);
  }

  function handlePromote(evt: MouseEvent) {
    evt.stopPropagation();
    dispatch('promote', bookmark);
  }

  function handleDelete(evt: MouseEvent) {
    evt.stopPropagation();
    dispatch('delete', bookmark);
  }
</script>

<div
  tabindex="0"
  role="button"
  class="group flex cursor-pointer items-start justify-between gap-3 border-b border-gray-700/20 px-4 py-3 transition-colors hover:bg-black/5 dark:border-gray-300/20 dark:hover:bg-white/5 {isCurrentPosition
    ? 'bg-blue-500/10 dark:bg-blue-400/10'
    : ''}"
  on:click={handleSelect}
  on:keydown={(e) => e.key === 'Enter' && handleSelect()}
>
  <div class="flex min-w-0 flex-1 items-start gap-3">
    <div
      class="mt-1 shrink-0 text-base"
      style:color={bookmark.isAutosave ? '#9ca3af' : BOOKMARK_COLORS[bookmark.color] || '#3b82f6'}
    >
      <Fa icon={bookmark.isAutosave ? faClock : faBookmark} />
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
        <span
          >{bookmark.isAutosave
            ? formatRelativeTime(bookmark.createdAt)
            : formatDate(bookmark.createdAt)}</span
        >
        {#if isCurrentPosition}
          <span>•</span>
          <span
            class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-400/25 dark:text-blue-300"
          >
            Current
          </span>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex shrink-0 items-center gap-1">
    {#if bookmark.isAutosave}
      <button
        type="button"
        class="flex items-center gap-1 rounded bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600 opacity-80 transition-opacity hover:bg-blue-600 hover:text-white hover:opacity-100 focus:outline-none dark:bg-blue-400/20 dark:text-blue-400"
        title="Keep as permanent bookmark"
        on:click={handlePromote}
      >
        <Fa icon={faBookmark} />
        <span>Keep</span>
      </button>
    {:else}
      <button
        type="button"
        class="rounded p-1.5 opacity-50 transition-opacity hover:text-blue-500 hover:opacity-100 focus:outline-none"
        title="Edit Bookmark"
        on:click={handleEdit}
      >
        <Fa icon={faPen} />
      </button>
    {/if}
    <button
      type="button"
      class="rounded p-1.5 opacity-50 transition-opacity hover:text-red-500 hover:opacity-100 focus:outline-none"
      title={bookmark.isAutosave ? 'Delete Autosave' : 'Delete Bookmark'}
      on:click={handleDelete}
    >
      <Fa icon={faTrash} />
    </button>
  </div>
</div>
