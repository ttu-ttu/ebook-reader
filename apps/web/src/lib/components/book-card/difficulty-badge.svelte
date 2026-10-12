<script lang="ts">
  import { difficultyColor, difficultyName } from '$lib/data/difficulty';

  export let difficulty: number;
  export let low: number | undefined = undefined;
  export let high: number | undefined = undefined;
  export let words95: number | undefined = undefined;
  /** Meter only, without the band name */
  export let compact = false;

  $: range =
    low !== undefined && high !== undefined ? `, likely ${low.toFixed(1)}-${high.toFixed(1)}` : '';
  $: words = words95
    ? `\nKnowing the ${words95.toLocaleString()} most common words covers 95% of its words`
    : '';
  $: summary = `Difficulty ${difficulty.toFixed(2)} of 5 (${difficultyName(difficulty)})${range}`;
  /** How full each of the five segments is, 0-1 */
  $: fills = [0, 1, 2, 3, 4].map((i) => Math.min(Math.max(difficulty - i, 0), 1));
</script>

<span
  class="difficulty-badge"
  style:--difficulty-color={difficultyColor(difficulty)}
  role="img"
  aria-label={summary}
  title="{summary}, estimated by chimi-difficulty{words}"
>
  <span class="difficulty-meter" aria-hidden="true">
    {#each fills as fill, i (i)}
      <span class="difficulty-segment"><span style:width="{fill * 100}%" /></span>
    {/each}
  </span>
  {#if !compact}<span class="difficulty-label">{difficultyName(difficulty)}</span>{/if}
</span>

<style>
  .difficulty-badge {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.4rem;
    color: var(--app-muted-fg);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
  }

  .difficulty-meter {
    display: inline-flex;
    gap: 2px;
  }

  .difficulty-segment {
    display: block;
    width: 0.55rem;
    height: 0.3rem;
    overflow: hidden;
    border-radius: 1px;
    background: var(--app-progress-track);
  }

  .difficulty-segment > span {
    display: block;
    height: 100%;
    background: var(--difficulty-color);
  }
</style>
