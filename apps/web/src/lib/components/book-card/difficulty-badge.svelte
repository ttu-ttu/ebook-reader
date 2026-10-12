<script lang="ts">
  import { difficultyColor, difficultyName } from '$lib/data/difficulty';

  export let difficulty: number;
  export let compact = false;
</script>

<span
  class="difficulty-badge"
  style:--difficulty-color={difficultyColor(difficulty)}
  title="Difficulty {difficulty.toFixed(2)} of 5 ({difficultyName(difficulty)}), estimated locally with Jiten's model"
>
  <span class="difficulty-dot" />
  {difficulty.toFixed(1)}{#if !compact}<span class="difficulty-label">{difficultyName(difficulty)}</span
    >{/if}
</span>

<style>
  .difficulty-badge {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.3rem;
    padding: 0.05rem 0.45rem;
    border: 1px solid color-mix(in srgb, var(--difficulty-color) 40%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--difficulty-color) 12%, transparent);
    color: color-mix(in srgb, var(--difficulty-color) 70%, var(--font-color));
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1.4;
    white-space: nowrap;
  }

  .difficulty-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: var(--difficulty-color);
  }

  .difficulty-label {
    font-weight: 700;
  }
</style>
