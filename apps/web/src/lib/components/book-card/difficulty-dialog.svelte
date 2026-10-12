<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { difficultyApiUrl } from '$lib/data/calibre';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';

  /** Calibre ids of the selected books, if any */
  export let selectedIds: number[] = [];

  interface Status {
    job: {
      type: 'compute';
      done: number;
      total: number;
      started: number;
      finished?: number;
      cancelled?: boolean;
      error?: string;
    } | null;
    /** Whether Jiten's frequency list is installed on the server */
    dictionary: boolean;
    results: number;
    /** Books without enough text to estimate (image-only manga and scans) */
    noText?: number;
    /** Books whose file can't be read (not a zip, no container.xml) */
    failed?: number;
    workers: number;
  }

  const dispatch = createEventDispatcher<{ close: void }>();

  let status: Status | undefined;
  let error = '';
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let finishedCompute = false;

  $: running = !!status?.job && !status.job.finished;

  onMount(poll);

  onDestroy(() => clearTimeout(pollTimer));

  async function poll() {
    clearTimeout(pollTimer);

    try {
      const response = await fetch(`${difficultyApiUrl}status`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Difficulty service unavailable (HTTP ${response.status})`);
      }

      const wasRunning = running;

      status = await response.json();
      error = '';

      if (wasRunning && !running) {
        finishedCompute = true;
      }
    } catch (e: any) {
      error = e.message;
    }

    if (running) {
      pollTimer = setTimeout(poll, 2000);
    }
  }

  async function post(action: string, body: object = {}) {
    try {
      const response = await fetch(`${difficultyApiUrl}${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(
          (await response.json().catch(() => ({}))).error || `HTTP ${response.status}`
        );
      }

      finishedCompute = false;
      status = await response.json();
      error = '';
      poll();
    } catch (e: any) {
      error = e.message;
    }
  }

</script>

<DialogTemplate>
  <svelte:fragment slot="header">Difficulty estimates</svelte:fragment>
  <div slot="content" class="flex max-w-xl flex-col gap-4 text-sm">
    <p>
      Difficulty (0 Beginner – 5 Insane) is estimated on the server only when you start it, with
      <a class="underline" href="https://github.com/Sirush/Jiten" target="_blank">Jiten</a>'s
      text features and word frequencies and a model trained on jiten.moe's own scores, so the
      numbers are on jiten.moe's scale (typically within about 0.2 of it).
    </p>

    {#if error}
      <p class="text-[color:var(--app-danger-color)]">{error}</p>
    {/if}

    {#if !status && !error}
      <p class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Loading status...</p>
    {:else if status}
      <section class="flex flex-col gap-2">
        <h3 class="font-bold">Estimate difficulty</h3>
        {#if !status.dictionary}
          <p class="text-[color:var(--app-danger-color)]">
            Jiten's frequency list is not installed on the server (see docs/INSTALL.md,
            "Difficulty estimates").
          </p>
        {/if}
        <p class="text-[color:var(--app-muted-fg)]">
          {status.results.toLocaleString()} books have an estimate. "Books without an estimate" also
          redoes estimates made by an older model. Each book takes about a second per
          worker ({status.workers} workers).
          {#if status.noText}
            {status.noText.toLocaleString()} books have no text to estimate (image-only manga and scans)
            and are skipped.
          {/if}
          {#if status.failed}
            {status.failed.toLocaleString()} books have a damaged file and are skipped until the file
            is replaced in Calibre.
          {/if}
        </p>
        <div class="flex flex-wrap gap-2">
          {#if selectedIds.length}
            <button
              class={buttonClasses}
              disabled={running || !status.dictionary}
              on:click={() => post('compute', { ids: selectedIds })}
            >
              Selected books ({selectedIds.length})
            </button>
          {/if}
          <button
            class={buttonClasses}
            disabled={running || !status.dictionary}
            on:click={() => post('compute', { all: true })}
          >
            Books without an estimate
          </button>
        </div>
      </section>

      {#if status.job}
        {@const job = status.job}
        <section class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            {#if running}<Fa icon={faSpinner} spin />{/if}
            <span class="font-semibold">
              Estimating difficulty:
              {job.done.toLocaleString()} / {job.total.toLocaleString()}
              {#if job.cancelled}(cancelled){:else if job.error}(failed){:else if job.finished}(done){/if}
            </span>
          </div>
          <progress class="w-full" value={job.done} max={job.total || 1} />
          {#if job.error}
            <p class="text-[color:var(--app-danger-color)]">{job.error}</p>
          {/if}
          {#if running}
            <button class="{buttonClasses} self-start" on:click={() => post('cancel')}
              >Cancel</button
            >
          {/if}
        </section>
      {/if}
    {/if}
  </div>
  <div slot="footer" class="flex gap-2">
    {#if finishedCompute}
      <button class={buttonClasses} on:click={() => window.location.reload()}>Reload library</button
      >
    {/if}
    <button class={buttonClasses} on:click={() => dispatch('close')}>Close</button>
  </div>
</DialogTemplate>
