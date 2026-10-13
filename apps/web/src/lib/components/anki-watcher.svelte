<script lang="ts">
  /**
   * While mounted and Anki mining is on (Settings → Anki), adds `media` to every note added to
   * Anki, and shows what happened in a small notice. Not part of upstream.
   */
  import {
    addMediaToNote,
    ankiEnabled$,
    watchAddedNotes,
    type AnkiMedia,
    type AnkiNote
  } from '$lib/data/anki';
  import { onDestroy } from 'svelte';

  export let media: (note: AnkiNote) => Promise<AnkiMedia>;

  let message = '';
  let error = false;
  let lastError = '';
  let hideTimer: ReturnType<typeof setTimeout>;
  let stop: (() => void) | undefined;

  $: if ($ankiEnabled$ && !stop) {
    stop = watchAddedNotes(addMedia, (failure) => {
      // Shown once per kind of failure, not on every check.
      if (failure && failure.message !== lastError) {
        show(failure.message, true);
      }
      lastError = failure?.message ?? '';
    });
  } else if (!$ankiEnabled$ && stop) {
    stop();
    stop = undefined;
  }

  function show(text: string, isError = false) {
    message = text;
    error = isError;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (message = ''), isError ? 8000 : 4000);
  }

  async function addMedia(note: AnkiNote) {
    try {
      show('Adding media to the Anki card…');

      const found = await media(note);

      if (!found.audio && !found.picture) {
        message = '';
        return;
      }

      const filled = await addMediaToNote(note, found);

      show(
        filled.length
          ? `Added to the Anki card: ${filled.join(', ')}`
          : 'Nothing added to the Anki card (fields missing or already filled)'
      );
    } catch (failure: any) {
      show(`Anki: ${failure.message}`, true);
    }
  }

  onDestroy(() => {
    stop?.();
    clearTimeout(hideTimer);
  });
</script>

{#if message}
  <div
    class="anki-notice reader-panel writing-horizontal-tb"
    class:text-danger={error}
    role="status"
  >
    {message}
  </div>
{/if}

<style>
  .anki-notice {
    position: fixed;
    top: 3.5rem;
    left: 50%;
    z-index: 60;
    max-width: calc(100vw - 2rem);
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    box-shadow: 0 10px 30px -12px var(--shadow-color);
    font-size: 0.8rem;
    transform: translateX(-50%);
  }
</style>
