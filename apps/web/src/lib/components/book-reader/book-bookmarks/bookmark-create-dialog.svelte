<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { createEventDispatcher } from 'svelte';
  import { BOOKMARK_COLORS, type BookmarkColor } from './bookmark-types';

  export let title = 'New Bookmark';
  export let initialLabel = '';
  export let initialColor: BookmarkColor = 'blue';
  export let initialNote = '';
  export let resolver: (
    arg0: { label: string; color: BookmarkColor; note: string } | undefined
  ) => void;

  let label = initialLabel;
  let selectedColor: BookmarkColor = initialColor;
  let note = initialNote;

  const colorKeys = Object.keys(BOOKMARK_COLORS) as BookmarkColor[];

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function save() {
    resolver({
      label: label.trim() || initialLabel || 'Bookmark',
      color: selectedColor,
      note: note.trim()
    });
    dispatch('close');
  }

  function cancel() {
    resolver(undefined);
    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="header">{title}</svelte:fragment>
  <div class="flex flex-col gap-4 text-sm text-gray-800 sm:text-base" slot="content">
    <div>
      <label for="bookmark-label" class="mb-1 block font-medium">Label</label>
      <input
        id="bookmark-label"
        type="text"
        class="w-full rounded border border-gray-300 px-3 py-1.5 focus:border-blue-500 focus:outline-none"
        bind:value={label}
        on:keyup={(evt) => {
          if (evt.key === 'Enter') {
            save();
          }
        }}
      />
    </div>

    <div>
      <span class="mb-1 block font-medium">Color</span>
      <div class="flex flex-wrap gap-2 pt-1">
        {#each colorKeys as colorKey}
          <button
            type="button"
            class="h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
            class:ring-2={selectedColor === colorKey}
            class:ring-offset-2={selectedColor === colorKey}
            class:ring-gray-700={selectedColor === colorKey}
            style:background-color={BOOKMARK_COLORS[colorKey]}
            title={colorKey}
            on:click={() => (selectedColor = colorKey)}
          />
        {/each}
      </div>
    </div>

    <div>
      <label for="bookmark-note" class="mb-1 block font-medium">Note (optional)</label>
      <textarea
        id="bookmark-note"
        rows="2"
        class="w-full rounded border border-gray-300 px-3 py-1.5 focus:border-blue-500 focus:outline-none"
        placeholder="Add an optional note..."
        bind:value={note}
      />
    </div>
  </div>
  <div class="flex grow justify-between pt-2" slot="footer">
    <button class={buttonClasses} on:click={cancel}>
      Cancel
      <Ripple />
    </button>
    <button class="{buttonClasses} bg-blue-600 text-white hover:bg-blue-700" on:click={save}>
      Save
      <Ripple />
    </button>
  </div>
</DialogTemplate>
