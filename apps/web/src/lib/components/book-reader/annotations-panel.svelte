<script lang="ts">
  import { faCopy, faDownload, faNoteSticky, faPen } from '@fortawesome/free-solid-svg-icons';
  import { highlightsToMarkdown, type Highlight } from '$lib/data/annotations';
  import { downloadBlob } from '$lib/functions/file-dom/download-blob';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let title: string;
  export let highlights: Highlight[];
  export let syncError = '';

  const dispatch = createEventDispatcher<{
    jump: Highlight;
    edit: Highlight;
  }>();

  let notesOnly = false;
  let copied = false;

  $: shown = notesOnly ? highlights.filter((h) => h.note) : highlights;
  $: groups = shown.reduce<{ chapter: string; items: Highlight[] }[]>((acc, highlight) => {
    const last = acc[acc.length - 1];

    if (last && last.chapter === highlight.chapter) {
      last.items.push(highlight);
    } else {
      acc.push({ chapter: highlight.chapter, items: [highlight] });
    }

    return acc;
  }, []);

  function download() {
    downloadBlob(
      new Blob([highlightsToMarkdown(title, highlights)], { type: 'text/markdown' }),
      `${title.replace(/[\\/:*?"<>|]/g, '_')} - highlights.md`
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(highlightsToMarkdown(title, highlights));
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex items-center gap-3 px-4 py-2 text-xs">
    <label class="flex items-center gap-1.5">
      <input type="checkbox" bind:checked={notesOnly} />
      Only with notes
    </label>
    <span class="ml-auto opacity-70">
      {copied ? 'Copied' : `${highlights.length} highlight${highlights.length === 1 ? '' : 's'}`}
    </span>
    <button class="p-1.5" title="Copy as Markdown" disabled={!highlights.length} on:click={copy}>
      <Fa icon={faCopy} />
    </button>
    <button
      class="p-1.5"
      title="Download as Markdown"
      disabled={!highlights.length}
      on:click={download}
    >
      <Fa icon={faDownload} />
    </button>
  </div>

  {#if syncError}
    <p class="px-4 pb-2 text-xs text-panel-danger">{syncError}</p>
  {/if}

  <div class="flex-1 overflow-y-auto px-2 pb-4">
    {#if !shown.length}
      <p class="px-2 py-6 text-center opacity-70">
        {notesOnly ? 'No notes yet.' : 'Select text in the book and pick a colour to highlight it.'}
      </p>
    {/if}
    {#each groups as group, groupIndex (groupIndex)}
      {#if group.chapter}
        <h3 class="px-2 pb-1 pt-3 text-xs font-bold opacity-60">{group.chapter}</h3>
      {/if}
      {#each group.items as highlight (highlight.id)}
        <div class="annotation flex gap-2 rounded-lg px-2 py-2">
          <button
            type="button"
            class="min-w-0 flex-1 text-left"
            title="Go to this highlight"
            on:click={() => dispatch('jump', highlight)}
          >
            <span
              class="annotation-text block border-l-4 pl-2"
              style:border-color="var(--highlight-{highlight.color})"
              lang="ja">{highlight.text}</span
            >
            {#if highlight.note}
              <span class="mt-1 flex gap-1.5 pl-3 text-xs opacity-80">
                <Fa icon={faNoteSticky} class="mt-0.5 shrink-0" />
                <span class="whitespace-pre-wrap">{highlight.note}</span>
              </span>
            {/if}
          </button>
          <button
            type="button"
            class="self-start p-1.5 opacity-60 hover:opacity-100"
            title="Edit"
            on:click={() => dispatch('edit', highlight)}
          >
            <Fa icon={faPen} />
          </button>
        </div>
      {/each}
    {/each}
  </div>
</div>

<style>
  .annotation:hover {
    background: color-mix(in srgb, var(--reader-panel-fg) 7%, transparent);
  }

  .annotation-text {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
</style>
