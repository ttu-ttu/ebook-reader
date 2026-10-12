<script lang="ts">
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import { orderSeries } from '$lib/components/book-card/library-sort';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses, inputClasses } from '$lib/css-classes';
  import {
    findSeriesBooks,
    guessSeriesName,
    saveSeriesOverrides
  } from '$lib/data/series-overrides';
  import { createEventDispatcher } from 'svelte';

  /**
   * Series generator: makes a series (a folder in Store → Series) from one book
   * and the other books whose title contains the series name. Shared with every
   * reader (series-overrides.ts). Not part of upstream.
   */
  export let book: BookCardProps;
  export let books: BookCardProps[];
  export let resolver: (saved: boolean) => void;

  const resultLimit = 200;
  const dispatch = createEventDispatcher<{ close: void }>();

  let name = book.series || guessSeriesName(book.title);
  let checked = new Set<string>();
  let saving = false;
  let error = '';

  $: members = books.filter((card) => name.trim() && card.series === name.trim());
  $: candidates = orderSeries([
    ...new Set([book, ...members, ...findSeriesBooks(books, name.trim())])
  ]).slice(0, resultLimit);
  // Pre-check the book, books already in the series and books by the same author.
  $: checked = new Set(
    candidates
      .filter(
        (card) =>
          card === book ||
          card.series === name.trim() ||
          (!!book.authors && card.authors === book.authors)
      )
      .map((card) => card.title)
  );

  function toggle(title: string) {
    const next = new Set(checked);

    if (!next.delete(title)) {
      next.add(title);
    }
    checked = next;
  }

  $: allChecked = !!candidates.length && checked.size === candidates.length;

  function toggleAll() {
    checked = new Set(allChecked ? [] : candidates.map((card) => card.title));
  }

  async function save() {
    const series = name.trim();
    const changes: Record<string, string> = {};

    candidates.forEach((card) => {
      if (checked.has(card.title) && card.series !== series) {
        changes[card.title] = series;
      } else if (!checked.has(card.title) && card.series === series) {
        changes[card.title] = '';
      }
    });

    saving = true;
    error = '';

    try {
      await saveSeriesOverrides(changes);
      close(true);
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  function close(saved: boolean) {
    resolver(saved);
    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="header">Make series</svelte:fragment>
  <div slot="content" class="flex w-[min(80vw,48rem)] flex-col">
    <label class="flex flex-col gap-1 text-sm">
      Series name
      <input type="text" class={inputClasses} bind:value={name} maxlength="200" />
    </label>
    <p class="py-2 text-xs opacity-70">
      {checked.size} of {candidates.length} books found with this name in their title will be in the
      series. Unchecked books already in it are taken out.
    </p>
    <label
      class="flex cursor-pointer items-center gap-3 border-b border-line py-2 font-medium"
    >
      <input
        type="checkbox"
        checked={allChecked}
        indeterminate={!!checked.size && !allChecked}
        on:change={toggleAll}
      />
      Check all
    </label>
    <ul class="h-[50vh] overflow-y-auto">
      {#each candidates as card (card.title)}
        <li>
          <label
            class="flex cursor-pointer items-center gap-3 border-b border-line py-2 hover:bg-hover"
          >
            <input
              type="checkbox"
              checked={checked.has(card.title)}
              on:change={() => toggle(card.title)}
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{card.title}</span>
              <span class="block truncate text-xs opacity-70">
                {card.authors || ''}{card.series && card.series !== name.trim()
                  ? ` · now in ${card.series}`
                  : ''}
              </span>
            </span>
          </label>
        </li>
      {/each}
    </ul>
    {#if error}
      <p class="pt-2 text-sm text-danger">{error}</p>
    {/if}
  </div>
  <div class="flex grow items-center justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => close(false)}>
      Cancel
      <Ripple />
    </button>
    <button
      class={buttonClasses}
      class:opacity-50={saving || !name.trim() || !checked.size}
      disabled={saving || !name.trim() || !checked.size}
      on:click={save}
    >
      Save series
      <Ripple />
    </button>
  </div>
</DialogTemplate>
