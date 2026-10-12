<script lang="ts">
  import { faCheck } from '@fortawesome/free-solid-svg-icons';
  import { customAppThemes$, themeDefinitions$ } from '$lib/data/theme/theme-store';
  import { resolveTheme, type ResolvedTheme } from '$lib/data/theme/themes';
  import Fa from 'svelte-fa';

  export let value: string;
  /** Lists dark themes first (for the dark slot when following the system) */
  export let preferDark = false;
  export let label = 'Theme';

  $: themes = ($themeDefinitions$ ?? []).map((definition) =>
    resolveTheme(definition.id, $customAppThemes$)
  );
  $: light = { name: 'Light', themes: themes.filter((theme) => !theme.dark) };
  $: dark = { name: 'Dark', themes: themes.filter((theme) => theme.dark) };
  $: groups = preferDark ? [dark, light] : [light, dark];

  function choose(theme: ResolvedTheme) {
    value = theme.id;
  }

  function onKeydown(event: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];

    if (!step) {
      return;
    }

    event.preventDefault();
    const ordered = groups.flatMap((group) => group.themes);
    const index = ordered.findIndex((theme) => theme.id === value);
    const next = ordered[(index + step + ordered.length) % ordered.length];

    choose(next);
    (event.currentTarget as HTMLElement)
      .closest('.theme-swatches')
      ?.querySelector<HTMLElement>(`[data-theme-id="${CSS.escape(next.id)}"]`)
      ?.focus();
  }
</script>

<div class="theme-swatches" role="radiogroup" aria-label={label}>
  {#each groups as group (group.name)}
    {#if group.themes.length}
      <p class="theme-swatch-group">{group.name}</p>
      <div class="theme-swatch-grid">
        {#each group.themes as theme (theme.id)}
          {@const selected = theme.id === value}
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            tabindex={selected ? 0 : -1}
            class="theme-swatch"
            class:theme-swatch-selected={selected}
            data-theme-id={theme.id}
            title="{theme.name}{theme.builtIn ? '' : ' (custom)'}"
            on:click={() => choose(theme)}
            on:keydown={onKeydown}
          >
            <span class="theme-swatch-preview" style:background={theme.colors.background}>
              <span
                class="theme-swatch-surface"
                style:background={theme.colors.surfaceStrong}
                style:border-color={theme.colors.border}
              >
                <span class="theme-swatch-line" style:background={theme.colors.text} />
                <span class="theme-swatch-line short" style:background={theme.colors.mutedText} />
                <span class="theme-swatch-accent" style:background={theme.colors.accent} />
              </span>
              <span
                class="theme-swatch-page"
                style:background={theme.colors.readerBackground}
                style:color={theme.colors.readerText}
                lang="ja">ああ</span
              >
              {#if selected}
                <span class="theme-swatch-check" aria-hidden="true"><Fa icon={faCheck} /></span>
              {/if}
            </span>
            <span class="theme-swatch-name">
              {theme.name}{#if !theme.builtIn}<span class="theme-swatch-custom">custom</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .theme-swatches {
    display: grid;
    gap: 0.5rem;
  }

  .theme-swatch-group {
    margin-top: 0.4rem;
    color: var(--app-text-subtle);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .theme-swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.75rem;
  }

  .theme-swatch {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.35rem;
    border-radius: calc(0.5rem * var(--app-radius-scale));
    text-align: left;
  }

  .theme-swatch-preview {
    position: relative;
    display: grid;
    height: 4.25rem;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem;
    padding: 0.4rem;
    border: 1px solid var(--border-color);
    border-radius: calc(0.5rem * var(--app-radius-scale));
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .theme-swatch:hover .theme-swatch-preview {
    border-color: color-mix(in srgb, var(--font-color) 35%, var(--border-color));
  }

  .theme-swatch-selected .theme-swatch-preview,
  .theme-swatch-selected:hover .theme-swatch-preview {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 1px var(--accent-color);
  }

  .theme-swatch-surface {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.35rem;
    border: 1px solid;
    border-radius: 0.25rem;
  }

  .theme-swatch-line {
    height: 0.18rem;
    border-radius: 1px;
  }

  .theme-swatch-line.short {
    width: 60%;
  }

  .theme-swatch-accent {
    width: 45%;
    height: 0.22rem;
    margin-top: auto;
    border-radius: 1px;
  }

  .theme-swatch-page {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    font-family: var(--app-font-display);
    font-size: 0.85rem;
  }

  .theme-swatch-check {
    position: absolute;
    top: -0.4rem;
    right: -0.4rem;
    display: inline-flex;
    width: 1.2rem;
    height: 1.2rem;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    background: var(--accent-color);
    color: var(--app-accent-fg);
    font-size: 0.6rem;
  }

  .theme-swatch-name {
    overflow: hidden;
    font-size: 0.8rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .theme-swatch-selected .theme-swatch-name {
    font-weight: 600;
  }

  .theme-swatch-custom {
    margin-left: 0.35rem;
    color: var(--app-text-subtle);
    font-size: 0.68rem;
  }
</style>
