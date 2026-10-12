<script lang="ts">
  import { faRotateLeft } from '@fortawesome/free-solid-svg-icons';
  import { fromHexAndAlpha, parseCssColor, toHex } from '$lib/data/theme/color-utils';
  import { isValidColor } from '$lib/data/theme/themes';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let label: string;
  export let description: string;
  export let cssVar: string;
  /** Value set by this theme, undefined when inherited */
  export let value: string | undefined;
  /** Value it would have without the override */
  export let inherited: string;

  const dispatch = createEventDispatcher<{ change: string | undefined }>();

  let text = value ?? '';

  $: effective = value ?? inherited;
  $: parsed = parseCssColor(effective);
  $: hex = parsed ? toHex(parsed) : '#000000';
  $: alpha = parsed?.a ?? 1;
  $: text = value ?? '';
  $: invalid = !!text && !isValidColor(text);

  function setFromPicker(newHex: string, newAlpha: number) {
    dispatch('change', fromHexAndAlpha(newHex, newAlpha));
  }
</script>

<div class="theme-color-row" title="{description} ({cssVar})">
  <span class="min-w-0">
    <span class="block truncate text-sm font-semibold">{label}</span>
    <span class="block truncate text-xs text-[color:var(--app-muted-fg)]">{description}</span>
  </span>
  <span class="theme-color-preview" style:--preview={effective}>
    <input
      type="color"
      value={hex}
      aria-label="{label} colour"
      on:input={(event) => setFromPicker(event.currentTarget.value, alpha)}
    />
  </span>
  <input
    type="range"
    min="0"
    max="1"
    step="0.01"
    value={alpha}
    aria-label="{label} opacity"
    title="Opacity {Math.round(alpha * 100)}%"
    on:input={(event) => setFromPicker(hex, Number(event.currentTarget.value))}
  />
  <input
    class="theme-color-text"
    class:theme-color-invalid={invalid}
    type="text"
    spellcheck="false"
    placeholder={inherited}
    value={text}
    on:change={(event) => {
      const next = event.currentTarget.value.trim();

      if (!next) {
        dispatch('change', undefined);
      } else if (isValidColor(next)) {
        dispatch('change', next);
      }
    }}
  />
  <button
    type="button"
    class="p-1.5 disabled:opacity-25"
    title="Use the inherited colour"
    disabled={value === undefined}
    on:click={() => dispatch('change', undefined)}
  >
    <Fa icon={faRotateLeft} />
  </button>
</div>

<style>
  .theme-color-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 2.25rem 5.5rem minmax(0, 11rem) 2rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--font-color) 7%, transparent);
  }

  @media (max-width: 640px) {
    .theme-color-row {
      grid-template-columns: minmax(0, 1fr) 2.25rem 2rem;
    }

    .theme-color-row input[type='range'],
    .theme-color-text {
      grid-column: 1 / -1;
    }
  }

  .theme-color-preview {
    position: relative;
    width: 2.25rem;
    height: 2.25rem;
    overflow: hidden;
    border: 1px solid var(--app-control-border);
    border-radius: 0.6rem;
    background:
      linear-gradient(var(--preview), var(--preview)),
      repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%) 50% / 10px 10px;
  }

  .theme-color-preview input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .theme-color-text {
    width: 100%;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--app-control-border);
    border-radius: 0.5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
  }

  .theme-color-invalid {
    border-color: var(--app-danger-color);
  }
</style>
