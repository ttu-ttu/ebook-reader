<script lang="ts">
  import { aiLanguage$ } from '$lib/data/ai-settings';

  /** One-click switch of the AI prompt and answer language. Not part of upstream. */
  const options = [
    { value: 'en', label: 'EN', title: 'AI answers in English' },
    { value: 'ja', label: '日本語', title: 'AIは日本語で答えます' }
  ];
</script>

<div class="toggle" role="radiogroup" aria-label="AI language">
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={$aiLanguage$ === option.value}
      class:active={$aiLanguage$ === option.value}
      title={option.title}
      on:click={() => ($aiLanguage$ = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .toggle {
    display: inline-flex;
    flex-shrink: 0;
    padding: 0.12rem;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 10%, transparent);
    font-size: 0.7rem;
    font-weight: 700;
  }

  button {
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    opacity: 0.6;
  }

  button.active {
    background: color-mix(in srgb, currentColor 18%, transparent);
    opacity: 1;
  }
</style>
