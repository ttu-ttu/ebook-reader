<script lang="ts">
  import type { LibraryDisplayMode } from '$lib/data/store';

  export let mode: LibraryDisplayMode;

  const progressWidths = [42, 0, 68, 24, 88, 52, 12, 76, 35, 60, 18, 94];
</script>

<div aria-busy="true" aria-label="Loading books">
  {#if mode === 'list'}
    <div class="flex flex-col gap-[0.45rem]">
      <div class="skeleton-list-header">
        <span>Title</span>
        <span>Progress</span>
        <span>Characters</span>
        <span>Last read</span>
        <span>Bookmarked</span>
      </div>
      {#each progressWidths.slice(0, 8) as width, index}
        <div class="skeleton-list-row">
          <span
            class="app-skeleton h-[0.9rem] rounded-full"
            style:width="{76 + (index % 3) * 8}%"
          />
          <span class="flex items-center gap-2">
            <span class="relative h-[0.55rem] flex-1 overflow-hidden rounded-full app-skeleton">
              <span
                class="absolute inset-y-0 left-0 rounded-full app-skeleton opacity-60"
                style:width="{width}%"
              />
            </span>
            <span class="app-skeleton h-3 w-8 rounded-full" />
          </span>
          {#each { length: 3 } as _}
            <span class="app-skeleton h-3 rounded-full" style:width="{index % 2 ? 52 : 68}%" />
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    <div class="skeleton-grid" class:skeleton-grid-compact={mode === 'covers-compact'}>
      {#each progressWidths as width}
        <div class="skeleton-card">
          <div class="skeleton-cover app-skeleton">
            <span class="skeleton-cover-mark" />
          </div>
          {#if mode === 'covers-comfortable'}
            <div class="flex flex-col gap-2 pt-3">
              <span class="app-skeleton h-3 rounded-full" style:width="{60 + (width % 35)}%" />
              <span class="app-skeleton h-2.5 w-1/2 rounded-full" />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
    gap: 2rem 1.5rem;
  }

  .skeleton-grid-compact {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 7rem), 1fr));
    gap: 1.25rem 1rem;
  }

  /* Same columns as book-card-list.svelte */
  @media (max-width: 639px) {
    .skeleton-grid {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 7.25rem), 1fr));
      gap: 1.5rem 0.9rem;
    }

    .skeleton-grid-compact {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 5.5rem), 1fr));
    }
  }

  .skeleton-card {
    min-width: 0;
  }

  .skeleton-cover {
    display: grid;
    border-radius: calc(4px * var(--app-radius-scale));
    aspect-ratio: 375 / 529;
    place-items: center;
  }

  .skeleton-cover-mark {
    width: 34%;
    aspect-ratio: 375 / 529;
    border: 2px solid color-mix(in srgb, var(--font-color) 8%, transparent);
    border-radius: 0.45rem;
  }

  .skeleton-list-header,
  .skeleton-list-row {
    display: grid;
    grid-template-columns:
      minmax(10rem, 3.6fr) minmax(6rem, 0.82fr) minmax(4rem, 0.55fr)
      minmax(4.5rem, 0.62fr) minmax(4.5rem, 0.62fr);
    align-items: center;
    gap: 0.5rem;
  }

  .skeleton-list-header {
    padding: 0 1.1rem 0.25rem;
    color: color-mix(in srgb, var(--font-color) 58%, var(--surface-color));
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .skeleton-list-header span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skeleton-list-row {
    min-height: 3.35rem;
    padding: 0.35rem 1.1rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
    border-radius: 0.95rem;
    background: color-mix(in srgb, var(--surface-strong-color) 92%, var(--background-color));
  }
</style>
