<script lang="ts">
  import {
    faClosedCaptioning,
    faCrosshairs,
    faPlay,
    faSpinner,
    faWandMagicSparkles
  } from '@fortawesome/free-solid-svg-icons';
  import WhisperSubtitles from '$lib/components/book-reader/whisper-subtitles.svelte';
  import {
    absCandidateKey,
    absFileText,
    absMatches$,
    absTrackUrl,
    audiobookshelfToken$,
    findAbsCandidates,
    getAbsProgress,
    getAbsSubtitles,
    putAbsSubtitles,
    saveAbsProgress,
    type AbsCandidate
  } from '$lib/data/audiobookshelf';
  import type { SearchIndex } from '$lib/functions/book-text/book-search';
  import {
    cueAt,
    matchableText,
    matchCues,
    parseSubtitles,
    type MatchedCue
  } from '$lib/functions/audiobook/subtitles';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  /**
   * Listen → Audiobookshelf: streams the book's audiobook from Audiobookshelf.
   * With subtitles (stored next to the audio there, or loaded here) it highlights
   * the line being read, like the audiobook mode.
   */
  export let title: string;
  export let getIndex: () => Promise<SearchIndex>;
  /** Current reading position */
  export let position: number;

  const dispatch = createEventDispatcher<{
    reading: { start: number; end: number } | undefined;
    jump: number;
  }>();

  let candidates: AbsCandidate[] = [];
  let candidate: AbsCandidate | undefined;
  let trackIndex = 0;
  let audio: HTMLAudioElement | undefined;
  /** Where to start in the candidate once its track is loaded */
  let resumeAt = 0;
  let status = '';
  let saveTimer: ReturnType<typeof setInterval> | undefined;
  let cues: MatchedCue[] = [];
  let subtitleName = '';
  let matching = false;
  let activeIndex = -1;
  let subtitleInput: HTMLInputElement;
  let whisperOpen = false;

  $: activeCue = cues[activeIndex] as MatchedCue | undefined;
  $: foundCount = cues.filter((cue) => cue.start !== undefined).length;

  $: track = candidate?.tracks[trackIndex];
  $: src = candidate && track ? absTrackUrl(candidate.itemId, track) : '';
  $: total = candidate?.tracks.reduce((sum, item) => sum + item.duration, 0) ?? 0;

  onMount(async () => {
    if (!$audiobookshelfToken$) {
      status = 'Connect Audiobookshelf in Settings → Audiobookshelf.';
      return;
    }

    const saved = $absMatches$[title]?.candidate;

    status = 'Searching Audiobookshelf…';
    try {
      candidates = await findAbsCandidates(title);
      status = candidates.length ? '' : 'Not found in Audiobookshelf.';
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }

    // The one picked last time, if Audiobookshelf still has it.
    const pick = candidates.find((c) => sameCandidate(c, saved)) ?? candidates[0];

    if (pick) {
      await choose(pick);
    }
  });

  onDestroy(() => {
    clearInterval(saveTimer);
    save();
    dispatch('reading', undefined);
  });

  function sameCandidate(a: AbsCandidate | undefined, b: AbsCandidate | undefined) {
    return !!a && !!b && a.itemId === b.itemId && a.label === b.label;
  }

  async function choose(next: AbsCandidate) {
    save();
    candidate = next;
    const saved = $absMatches$[title];
    const start = next.wholeItem
      ? await getAbsProgress(next.itemId)
      : (sameCandidate(saved?.candidate, next) && saved?.position) || 0;

    absMatches$.next({ ...absMatches$.getValue(), [title]: { candidate: next, position: start } });
    // A new src: start there once it loads (the old audio is still playing).
    trackIndex = Math.max(0, next.tracks.filter((item) => item.startOffset <= start).length - 1);
    resumeAt = start - next.tracks[trackIndex].startOffset;
    await loadSubtitles(next);
  }

  /** Subtitles matched before for this audiobook, else ones stored with it in Audiobookshelf. */
  async function loadSubtitles(next: AbsCandidate) {
    cues = [];
    subtitleName = '';
    activeIndex = -1;
    dispatch('reading', undefined);

    const stored = await getAbsSubtitles(title).catch(() => undefined);

    if (stored?.candidate === absCandidateKey(next)) {
      cues = stored.cues;
      subtitleName = stored.subtitleName;
    } else if (next.subtitles.length) {
      await useSubtitles(() => absFileText(next.itemId, next.subtitles[0]), 'Audiobookshelf');
    }
  }

  async function useSubtitles(read: () => Promise<string>, name: string) {
    if (!candidate) {
      return;
    }

    const forCandidate = candidate;

    matching = true;
    try {
      const parsed = parseSubtitles(await read());

      if (!parsed.length) {
        throw new Error('No subtitle lines found (SRT or VTT expected)');
      }

      const bookText = (await getIndex()).paragraphs.map((p) => matchableText(p.text)).join('');
      // Let the spinner render before the (synchronous) matching.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const matched = matchCues(parsed, bookText);

      if (!matched.some((cue) => cue.start !== undefined)) {
        throw new Error('None of the subtitle lines were found in this book');
      }
      if (candidate !== forCandidate) {
        return;
      }
      cues = matched;
      subtitleName = name;
      await putAbsSubtitles({
        title,
        candidate: absCandidateKey(forCandidate),
        subtitleName: name,
        cues: matched
      }).catch(() => {
        status = 'Not enough browser storage to keep the subtitles';
      });
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      matching = false;
    }
  }

  function onSubtitleFile() {
    const file = subtitleInput.files?.[0];

    if (file) {
      useSubtitles(() => file.text(), file.name);
    }
    subtitleInput.value = '';
  }

  /** Moves to a time in the audiobook, switching tracks if needed. */
  function seekTo(seconds: number) {
    if (!candidate) {
      return;
    }

    const index = Math.max(
      0,
      candidate.tracks.filter((item) => item.startOffset <= seconds).length - 1
    );
    const offset = seconds - candidate.tracks[index].startOffset;

    if (index === trackIndex && audio && audio.readyState > 0) {
      audio.currentTime = offset;
    } else {
      trackIndex = index;
      resumeAt = offset;
    }
  }

  function onTimeUpdate() {
    const time = currentPosition();

    if (time === undefined || !cues.length) {
      return;
    }

    const index = cueAt(cues, time);

    if (index !== activeIndex) {
      activeIndex = index;

      const cue = cues[index];

      dispatch(
        'reading',
        cue?.start !== undefined ? { start: cue.start, end: cue.end! } : undefined
      );
    }
  }

  function playFromHere() {
    const cue = cues.find((item) => item.end !== undefined && item.end > position);

    if (!cue) {
      status = 'No matched line at or after this position';
      return;
    }

    seekTo(cue.startSeconds);
    audio?.play();
  }

  function currentPosition() {
    return track && audio ? track.startOffset + audio.currentTime : undefined;
  }

  function save() {
    const position = currentPosition();

    if (!candidate || position === undefined || !position) {
      return;
    }
    if (candidate.wholeItem) {
      saveAbsProgress(candidate.itemId, position, total).catch((error) => {
        status = error instanceof Error ? error.message : String(error);
      });
    } else {
      absMatches$.next({ ...absMatches$.getValue(), [title]: { candidate, position } });
    }
  }

  function onLoaded() {
    if (audio && resumeAt) {
      audio.currentTime = resumeAt;
      resumeAt = 0;
    }
  }

  function onEnded() {
    if (candidate && trackIndex < candidate.tracks.length - 1) {
      trackIndex += 1;
      // The next track's src loads after the update; keep playing it.
      audio?.addEventListener('loadedmetadata', () => audio?.play(), { once: true });
    } else {
      save();
    }
  }

  function onPlay() {
    clearInterval(saveTimer);
    saveTimer = setInterval(save, 15_000);
  }

  function onPause() {
    clearInterval(saveTimer);
    save();
  }
</script>

<div class="flex min-w-0 flex-1 items-center gap-2">
  {#if candidates.length > 1}
    <select
      class="abs-select"
      aria-label="Audiobook"
      value={candidates.findIndex((c) => sameCandidate(c, candidate))}
      on:change={(event) => choose(candidates[Number(event.currentTarget.value)])}
    >
      {#each candidates as option, index}
        <option value={index}>{option.label}</option>
      {/each}
    </select>
  {/if}
  {#if src}
    <!-- svelte-ignore a11y-media-has-caption: the subtitles are shown as the book's own text -->
    <audio
      bind:this={audio}
      class="min-w-0 flex-1"
      controls
      preload="metadata"
      {src}
      title={candidate?.label}
      on:loadedmetadata={onLoaded}
      on:ended={onEnded}
      on:play={onPlay}
      on:pause={onPause}
      on:timeupdate={onTimeUpdate}
    />
    {#if cues.length}
      <button class="abs-icon" title="Play from the reading position" on:click={playFromHere}>
        <Fa icon={faPlay} />
      </button>
      <button
        class="abs-icon"
        title="Go to the line being read"
        disabled={activeCue?.start === undefined}
        on:click={() => activeCue?.start !== undefined && dispatch('jump', activeCue.start)}
      >
        <Fa icon={faCrosshairs} />
      </button>
    {/if}
    <button
      class="abs-icon"
      class:abs-icon-active={cues.length}
      title={cues.length
        ? `Subtitles: ${subtitleName}, ${foundCount} of ${cues.length} lines found. Load others (SRT or VTT)`
        : 'Load subtitles (SRT or VTT) to follow the text'}
      disabled={matching}
      on:click={() => subtitleInput.click()}
    >
      <Fa icon={matching ? faSpinner : faClosedCaptioning} spin={matching} />
    </button>
    <button
      class="abs-icon"
      class:abs-icon-active={whisperOpen}
      title="Make subtitles with Whisper in this browser"
      on:click={() => (whisperOpen = !whisperOpen)}
    >
      <Fa icon={faWandMagicSparkles} />
    </button>
    {#if whisperOpen && candidate}
      {@const forCandidate = candidate}
      <!-- Another audiobook stops the transcription. -->
      {#key forCandidate}
        <WhisperSubtitles
          name={forCandidate.label}
          sources={() =>
            forCandidate.tracks.map((item) => ({
              url: absTrackUrl(forCandidate.itemId, item),
              offset: item.startOffset
            }))}
          on:srt={({ detail }) => useSubtitles(() => Promise.resolve(detail), 'Whisper')}
        />
      {/key}
    {/if}
    <input
      bind:this={subtitleInput}
      class="hidden"
      type="file"
      accept=".srt,.vtt"
      on:change={onSubtitleFile}
    />
  {/if}
  {#if status}
    <span class="min-w-0 truncate opacity-70" role="status">{status}</span>
  {/if}
</div>

<style>
  .abs-select {
    max-width: 9rem;
    border-radius: 0.5rem;
    background: transparent;
    font-size: 0.8rem;
  }

  audio {
    height: 2.25rem;
  }

  .abs-icon {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    opacity: 0.6;
  }

  .abs-icon:hover,
  .abs-icon-active {
    opacity: 1;
  }
</style>
