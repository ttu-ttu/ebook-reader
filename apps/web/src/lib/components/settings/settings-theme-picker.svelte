<script lang="ts">
  import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import { customAppThemes$, themeDefinitions$ } from '$lib/data/theme/theme-store';
  import { resolveTheme, type ResolvedTheme } from '$lib/data/theme/themes';
  import Fa from 'svelte-fa';

  export let value: string;
  /** Lists dark themes first (for the dark slot when following the system) */
  export let preferDark = false;

  let popover: Popover;

  $: themes = ($themeDefinitions$ ?? [])
    .map((definition) => resolveTheme(definition.id, $customAppThemes$))
    .sort((a, b) => (preferDark ? Number(b.dark) - Number(a.dark) : Number(a.dark) - Number(b.dark)));
  $: selected = resolveTheme(value, $customAppThemes$);

  function choose(theme: ResolvedTheme) {
    value = theme.id;
    popover.toggleOpen();
  }
</script>

<Popover
  bind:this={popover}
  placement="bottom-start"
  fallbackPlacements={['top-start', 'bottom']}
  yOffset={6}
  panelClasses="app-popover-panel theme-picker-panel"
>
  <button slot="icon" type="button" class="theme-picker-trigger" title="Choose theme">
    <span
      class="theme-picker-swatch"
      style:color={selected.colors.readerText}
      style:background-color={selected.colors.readerBackground}>ぁあ</span
    >
    <span class="theme-picker-label">{selected.name}</span>
    <Fa icon={faChevronDown} class="opacity-60" />
  </button>
  <div slot="content" class="theme-picker-list" role="listbox" aria-label="Themes">
    {#each themes as theme (theme.id)}
      <button
        type="button"
        role="option"
        aria-selected={theme.id === value}
        class="theme-picker-option"
        class:theme-picker-option-active={theme.id === value}
        on:click={() => choose(theme)}
      >
        <span
          class="theme-picker-swatch"
          style:color={theme.colors.readerText}
          style:background-color={theme.colors.readerBackground}>ぁあ</span
        >
        <span class="theme-picker-label">
          {theme.name}
          <span class="theme-picker-kind">{theme.dark ? 'Dark' : 'Light'}{theme.builtIn ? '' : ' · custom'}</span>
        </span>
        {#if theme.id === value}<Fa icon={faCheck} class="text-[color:var(--accent-strong-color)]" />{/if}
      </button>
    {/each}
  </div>
</Popover>

<style>
  .theme-picker-trigger {
    display: inline-grid;
    min-width: min(100%, 16rem);
    min-height: 2.75rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    overflow: hidden;
    padding: 0.3rem 0.75rem 0.3rem 0.3rem;
    border: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
    border-radius: calc(1rem * var(--app-radius-scale));
    background: color-mix(in srgb, var(--surface-color) 96%, var(--background-color));
    box-shadow: inset 0 1px color-mix(in srgb, var(--app-inset-highlight) 50%, transparent);
    color: var(--font-color);
    text-align: left;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease;
  }

  .theme-picker-trigger:hover {
    border-color: color-mix(in srgb, var(--font-color) 15%, var(--border-color));
    background: color-mix(in srgb, var(--font-color) 4%, var(--surface-color));
  }

  .theme-picker-swatch {
    display: inline-flex;
    min-width: 3.8rem;
    min-height: 2.05rem;
    align-items: center;
    justify-content: center;
    padding: 0 0.5rem;
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: calc(0.75rem * var(--app-radius-scale));
    font-weight: 700;
  }

  .theme-picker-label {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    font-size: 0.92rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .theme-picker-kind {
    color: var(--app-muted-fg);
    font-size: 0.72rem;
    font-weight: 650;
  }

  .theme-picker-list {
    display: grid;
    width: min(22rem, calc(100vw - 2rem));
    max-height: min(26rem, 60vh);
    gap: 0.2rem;
    overflow-y: auto;
    padding: 0.35rem;
  }

  .theme-picker-option {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    padding: 0.35rem 0.65rem 0.35rem 0.35rem;
    border-radius: calc(0.9rem * var(--app-radius-scale));
    color: var(--font-color);
    text-align: left;
  }

  .theme-picker-option:hover {
    background: color-mix(in srgb, var(--font-color) 6%, transparent);
  }

  .theme-picker-option-active {
    background: color-mix(in srgb, var(--accent-color) 11%, transparent);
  }
</style>
