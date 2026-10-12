<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { createEventDispatcher } from 'svelte';

  /**
   * One question for all imported books that look like part of an existing
   * series: each is listed with its series, all checked. Not part of upstream.
   */
  export let suggestions: { title: string; series: string }[];
  /** The checked titles and their series (empty when cancelled) */
  export let resolver: (changes: Record<string, string>) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let checked = new Set(suggestions.map((s) => s.title));

  $: allChecked = checked.size === suggestions.length;

  function toggle(title: string) {
    const next = new Set(checked);

    if (!next.delete(title)) {
      next.add(title);
    }
    checked = next;
  }

  function toggleAll() {
    checked = new Set(allChecked ? [] : suggestions.map((s) => s.title));
  }

  function close(save: boolean) {
    resolver(
      save
        ? Object.fromEntries(
            suggestions.filter((s) => checked.has(s.title)).map((s) => [s.title, s.series])
          )
        : {}
    );
    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="header">Add to series</svelte:fragment>
  <div slot="content" class="flex w-[min(80vw,48rem)] flex-col">
    <p class="pb-2 text-sm opacity-70">
      These imported books look like part of a series already in the library.
    </p>
    {#if suggestions.length > 1}
      <label
        class="flex cursor-pointer items-center gap-3 border-b border-gray-400/20 py-2 font-medium"
      >
        <input
          type="checkbox"
          checked={allChecked}
          indeterminate={!!checked.size && !allChecked}
          on:change={toggleAll}
        />
        Check all
      </label>
    {/if}
    <ul class="max-h-[50vh] overflow-y-auto">
      {#each suggestions as suggestion (suggestion.title)}
        <li>
          <label
            class="flex cursor-pointer items-center gap-3 border-b border-gray-400/20 py-2 hover:bg-gray-500/10"
          >
            <input
              type="checkbox"
              checked={checked.has(suggestion.title)}
              on:change={() => toggle(suggestion.title)}
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{suggestion.title}</span>
              <span class="block truncate text-xs opacity-70">→ {suggestion.series}</span>
            </span>
          </label>
        </li>
      {/each}
    </ul>
  </div>
  <div class="flex grow items-center justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => close(false)}>
      Skip
      <Ripple />
    </button>
    <button
      class={buttonClasses}
      class:opacity-50={!checked.size}
      disabled={!checked.size}
      on:click={() => close(true)}
    >
      Add {checked.size || ''} to series
      <Ripple />
    </button>
  </div>
</DialogTemplate>
