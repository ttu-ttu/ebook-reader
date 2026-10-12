<script lang="ts">
  import { faChartLine, faFire } from '@fortawesome/free-solid-svg-icons';
  import { getKanjiSummary, type KanjiSummary } from '$lib/data/kanji-seen';
  import { learnerStats, type LearnerStats } from '$lib/data/learner-stats';
  import { database, startDayHoursForTracker$, statisticsEnabled$ } from '$lib/data/store';
  import { getDateKey } from '$lib/functions/statistic-util';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';

  /**
   * Home tab totals for Japanese learners: characters, time, speed, streaks
   * and how many different kanji were met. Not part of upstream.
   */

  let stats: LearnerStats | undefined;
  let kanji: KanjiSummary | undefined;

  const number = (value: number) => value.toLocaleString('en-US');

  function hours(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);

    return h ? `${h}h ${m}m` : `${m}m`;
  }

  onMount(async () => {
    const [statistics, summary] = await Promise.all([
      database.getStatisticsForTimeWindow('0000-00-00', '9999-99-99').catch(() => []),
      getKanjiSummary().catch(() => undefined)
    ]);

    stats = learnerStats(statistics, getDateKey($startDayHoursForTracker$));
    kanji = summary;
  });

  $: tiles = stats
    ? [
        { label: 'Characters read', value: number(stats.totalCharacters) },
        { label: 'Today', value: number(stats.todayCharacters) },
        { label: 'Past 7 days', value: number(stats.weekCharacters) },
        { label: 'Reading time', value: hours(stats.totalTime) },
        { label: 'Speed', value: stats.speed ? `${number(stats.speed)}/h` : '–' },
        {
          label: 'Streak',
          value: `${stats.streak} day${stats.streak === 1 ? '' : 's'}`,
          hint: `Longest ${stats.longestStreak} · ${stats.daysRead} days read`
        },
        {
          label: 'Books finished',
          value: number(stats.booksCompleted),
          hint: `${number(stats.booksStarted)} started`
        },
        { label: 'Kanji met', value: kanji ? number(kanji.unique) : '–' }
      ]
    : [];
</script>

<section class="dashboard app-surface-card" aria-label="Reading stats">
  <h2 class="dashboard-heading">
    <Fa icon={faChartLine} />
    Your reading
    {#if stats?.streak}
      <span class="dashboard-streak" title="Days in a row"><Fa icon={faFire} /> {stats.streak}</span
      >
    {/if}
  </h2>
  {#if stats}
    <div class="dashboard-tiles">
      {#each tiles as tile (tile.label)}
        <div class="dashboard-tile" title={tile.hint || undefined}>
          <span class="dashboard-value">{tile.value}</span>
          <span class="dashboard-label">{tile.label}</span>
          {#if tile.hint}<span class="dashboard-hint">{tile.hint}</span>{/if}
        </div>
      {/each}
    </div>
    {#if !$statisticsEnabled$ && !stats.daysRead}
      <p class="dashboard-note">
        Turn on the reading tracker (Settings → Statistics) to count characters, time and streaks.
      </p>
    {/if}
  {/if}
</section>

<style>
  .dashboard {
    margin-bottom: 1.25rem;
    padding: 0.9rem;
    border-radius: calc(1.15rem * var(--app-radius-scale));
  }

  .dashboard-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.7rem;
    color: var(--app-muted-fg);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .dashboard-streak {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: auto;
    color: var(--accent-strong-color);
    letter-spacing: 0;
  }

  .dashboard-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: 0.6rem;
  }

  .dashboard-tile {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--border-color);
    border-radius: calc(0.8rem * var(--app-radius-scale));
    background: color-mix(in srgb, var(--surface-strong-color) 70%, transparent);
  }

  .dashboard-value {
    font-size: 1.25rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .dashboard-label,
  .dashboard-hint,
  .dashboard-note {
    color: var(--app-muted-fg);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .dashboard-hint {
    font-weight: 600;
  }

  .dashboard-note {
    margin-top: 0.7rem;
  }
</style>
