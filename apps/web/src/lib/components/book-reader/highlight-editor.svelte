<script lang="ts">
  import { faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { highlightColors, type Highlight, type HighlightColor } from '$lib/data/annotations';
  import { createEventDispatcher, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  export let highlight: Highlight;
  export let focusNote = false;

  const dispatch = createEventDispatcher<{
    close: void;
    change: { note?: string; color?: HighlightColor };
    delete: void;
  }>();

  let note = highlight.note;
  let noteElm: HTMLTextAreaElement;

  onMount(() => {
    if (focusNote) {
      noteElm.focus();
    }
  });

  function close() {
    if (note !== highlight.note) {
      dispatch('change', { note });
    }
    dispatch('close');
  }
</script>

<aside
  class="reader-panel writing-horizontal-tb fixed inset-x-2 bottom-2 z-30 mx-auto flex max-w-xl flex-col gap-3 rounded-xl p-4 text-sm shadow-2xl"
  aria-label="Highlight"
>
  <div class="flex items-start gap-3">
    <blockquote class="reader-panel-quote max-h-28 flex-1 overflow-y-auto border-l-2 pl-3" lang="ja">
      {highlight.text}
    </blockquote>
    <button class="p-1" title="Close" on:click={close}><Fa icon={faXmark} /></button>
  </div>

  <textarea
    class="reader-panel-input min-h-[5rem] w-full resize-y rounded px-3 py-2"
    placeholder="Add a note..."
    bind:this={noteElm}
    bind:value={note}
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        close();
      }
      event.stopPropagation();
    }}
  />

  <div class="flex items-center gap-2">
    {#each highlightColors as color (color)}
      <button
        type="button"
        class="color-option"
        class:color-option-active={highlight.color === color}
        style:background-color="var(--highlight-{color})"
        title={color}
        on:click={() => {
          highlight = { ...highlight, color };
          dispatch('change', { color });
        }}
      />
    {/each}
    <span class="flex-1" />
    <button
      type="button"
      class="reader-panel-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
      on:click={() => dispatch('delete')}
    >
      <Fa icon={faTrash} /> Delete
    </button>
    <button
      type="button"
      class="reader-panel-chip rounded-full px-3 py-1.5 text-xs font-semibold"
      on:click={close}
    >
      Done
    </button>
  </div>
</aside>

<style>
  .color-option {
    width: 1.6rem;
    height: 1.6rem;
    border: 2px solid color-mix(in srgb, var(--reader-panel-fg) 35%, transparent);
    border-radius: 9999px;
  }

  .color-option-active {
    border-color: var(--reader-panel-fg);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--reader-panel-fg) 30%, transparent);
  }
</style>
