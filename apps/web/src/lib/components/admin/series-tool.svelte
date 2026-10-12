<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import { buttonClasses } from '$lib/css-classes';
  import { checkSeries, type SeriesReport } from '$lib/data/calibre-import';

  let report: SeriesReport | undefined;
  let busy = '';
  let error = '';

  $: changes = report ? report.assigned + report.merged : 0;

  async function run(apply: boolean) {
    busy = apply ? 'Writing to Calibre...' : 'Checking the library...';
    error = '';

    try {
      report = await checkSeries(apply);
    } catch (e: any) {
      error = e.message;
    } finally {
      busy = '';
    }
  }

  function volumes(numbers: number[]) {
    return numbers.map((n) => n.toLocaleString()).join(', ');
  }
</script>

<div class="flex flex-col gap-3 text-sm">
  <p>
    Puts books without a series into the series their titles name (volume numbers in the title),
    and merges series whose names differ only in width, case, spaces or separators. Books by
    another author are left out. Check first; nothing is written until you apply.
  </p>

  <div class="flex flex-wrap items-center gap-2">
    <button class={buttonClasses} disabled={!!busy} on:click={() => run(false)}>
      Check library
    </button>
    {#if report && !report.written && changes}
      <button class={buttonClasses} disabled={!!busy} on:click={() => run(true)}>
        Apply {changes.toLocaleString()} changes
      </button>
    {/if}
    {#if busy}
      <span class="flex items-center gap-2"><Fa icon={faSpinner} spin /> {busy}</span>
    {/if}
  </div>

  {#if error}
    <p class="text-[color:var(--app-danger-color)]">{error}</p>
  {/if}

  {#if report}
    {#if report.written}
      <p class="font-semibold">
        Done. metadata.db was backed up first ({report.backup}). The library shows the new series
        once the catalog is rebuilt, in a few minutes.
      </p>
    {:else if !changes}
      <p class="font-semibold">Nothing to change: every series is in order.</p>
    {/if}
    {#if changes}
      <p>
        {report.assigned.toLocaleString()} books {report.written ? 'were' : 'would be'} put into
        {report.series.length.toLocaleString()} series, and {report.merged.toLocaleString()} books
        in {report.merges.length.toLocaleString()} duplicate series {report.written
          ? 'were'
          : 'would be'} merged.
      </p>
    {/if}
    {#if report.merges.length}
      <details>
        <summary class="cursor-pointer font-semibold">Merged series</summary>
        <ul class="tool-list">
          {#each report.merges as merge}
            <li>{merge.from.join(', ')} → {merge.to} ({merge.books})</li>
          {/each}
        </ul>
      </details>
    {/if}
    {#if report.series.length}
      <details>
        <summary class="cursor-pointer font-semibold">Series that get books</summary>
        <ul class="tool-list">
          {#each report.series as entry}
            <li>{entry.name}: {volumes(entry.volumes)}</li>
          {/each}
        </ul>
      </details>
    {/if}
    {#if report.warnings.length}
      <details>
        <summary class="cursor-pointer font-semibold">
          Worth a look ({report.warnings.length.toLocaleString()})
        </summary>
        <ul class="tool-list">
          {#each report.warnings as warning}
            <li>{warning}</li>
          {/each}
        </ul>
      </details>
    {/if}
  {/if}
</div>

<style>
  .tool-list {
    display: grid;
    max-height: 18rem;
    gap: 0.2rem;
    margin-top: 0.4rem;
    overflow-y: auto;
    padding-left: 1.1rem;
    list-style: disc;
  }
</style>
