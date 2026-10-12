<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import { buttonClasses } from '$lib/css-classes';
  import { difficultyApiUrl } from '$lib/data/calibre';
  import { onDestroy, onMount } from 'svelte';
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
    /** Whether the frequency list is installed on the server */
    dictionary: boolean;
    results: number;
    /** Books without enough text to estimate (image-only manga and scans) */
    noText?: number;
    /** Books whose file can't be read (not a zip, no container.xml) */
    failed?: number;
    workers: number;
  }

  let status: Status | undefined;
  let error = '';
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  /** Set when a job started here has finished, so the library can be reloaded. */
  export let finishedCompute = false;

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

  let importing = false;

  /** Installs jiten_freq_global.zip on the server (it checks the file). */
  async function importDictionary(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    input.value = '';
    if (!file) {
      return;
    }

    importing = true;
    try {
      const response = await fetch(`${difficultyApiUrl}dictionary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: file
      });

      if (!response.ok) {
        throw new Error(
          (await response.json().catch(() => ({}))).error || `HTTP ${response.status}`
        );
      }

      status = await response.json();
      error = '';
    } catch (e: any) {
      error = e.message;
    } finally {
      importing = false;
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

<div class="flex max-w-xl flex-col gap-4 text-sm">
  <p>Estimates difficulty of books in the library on a scale from 0 Beginner to 5 Insane.</p>

  {#if error}
    <p class="text-[color:var(--app-danger-color)]">{error}</p>
  {/if}

  {#if !status && !error}
    <p class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Loading status...</p>
  {:else if status}
    {#if !status.dictionary}
      <div class="flex flex-col gap-2">
        <p>
          Estimates need Jiten's word frequency list. Download
          <strong>jiten_freq_global.zip</strong> from
          <a
            class="underline"
            href="https://jiten.moe/frequency-dictionaries"
            target="_blank"
            rel="noreferrer">jiten.moe/frequency-dictionaries</a
          >, then import it.
        </p>
        <label class="{buttonClasses} flex cursor-pointer items-center gap-2 self-start">
          {#if importing}<Fa icon={faSpinner} spin />{/if}
          Import frequency list
          <input
            type="file"
            accept=".zip,application/zip"
            class="hidden"
            disabled={importing}
            on:change={importDictionary}
          />
        </label>
      </div>
    {/if}
    <div class="flex flex-wrap gap-2">
      <button
        class={buttonClasses}
        title="Books without an estimate"
        disabled={running || !status.dictionary}
        on:click={() => post('compute', { all: true })}
      >
        Run
      </button>
      {#if selectedIds.length}
        <button
          class={buttonClasses}
          disabled={running || !status.dictionary}
          on:click={() => post('compute', { ids: selectedIds })}
        >
          Selected books ({selectedIds.length})
        </button>
      {/if}
    </div>

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
