<script lang="ts">
  import { faCheckCircle, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
  import BookCard from '$lib/components/book-card/book-card.svelte';
  import type { BookCardProps } from '$lib/components/book-card/book-card-props';
  import Popover from '$lib/components/popover/popover.svelte';
  import { dummyFn } from '$lib/functions/utils';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let bookCards: BookCardProps[] = [];
  export let currentBookId: number | undefined;
  export let selectedBookIds: ReadonlySet<number>;

  const dispatch = createEventDispatcher<{
    bookClick: {
      id: number;
    };
    removeBookClick: {
      id: number;
    };
  }>();

  let hoveringBookId: number | undefined;

  function onBookCardClick(id: number) {
    dispatch('bookClick', { id });
  }

  function getCardDateInfo(dateTime: number) {
    return dateTime ? new Date(dateTime).toLocaleString() : 'No Data';
  }
</script>

<div class="grid grid-cols-3 justify-between gap-5 pb-4 md:grid-cols-4 lg:grid-cols-5">
  {#each bookCards as bookCard (bookCard.id)}
    <div
      role="banner"
      class="relative"
      class:opacity-60={bookCard.isPlaceholder}
      on:mouseenter={() => (hoveringBookId = bookCard.id)}
      on:mouseleave={() => (hoveringBookId = undefined)}
    >
      <div
        class="mdc-elevation--z1 hover:mdc-elevation--z8 mdc-elevation-transition relative overflow-hidden"
        class:rounded-tl-xl={bookCard.id === currentBookId}
        class:mdc-elevation--z4={selectedBookIds.has(bookCard.id) || bookCard.id === currentBookId}
      >
        <BookCard {...bookCard} on:click={() => onBookCardClick(bookCard.id)} />

        {#if selectedBookIds.has(bookCard.id)}
          <div
            tabindex="0"
            role="button"
            title="Book selected"
            class="absolute inset-0 bg-gray-700 bg-opacity-20"
            on:click={() => onBookCardClick(bookCard.id)}
            on:keyup={dummyFn}
          >
            <Fa class="absolute left-2 top-2 flex text-xl text-white" icon={faCheckCircle} />
          </div>
        {/if}
      </div>
      {#if selectedBookIds.has(bookCard.id)}
        <div class="absolute top-10 left-2" title="Click to open details">
          <Popover placement="right" fallbackPlacements={['bottom']} yOffset={5}>
            <Fa
              slot="icon"
              class="mdc-elevation--z2 hover:mdc-elevation--z8 mdc-elevation-transition left-2 top-10 rounded-full bg-blue-400 text-xl text-white"
              icon={faCircleInfo}
            />
            <div class="p-4" slot="content">
              <div>Characters:</div>
              <div class="w-40">{bookCard.characters || 'No Data'}</div>
              <div class="mt-4">Last Read:</div>
              <div class="w-40">{getCardDateInfo(bookCard.lastBookOpen)}</div>
              <div class="mt-4">Bookmarked:</div>
              <div class="w-40">{getCardDateInfo(bookCard.lastBookmarkModified)}</div>
              <div class="mt-4">Last Update:</div>
              <div class="w-40">{getCardDateInfo(bookCard.lastBookModified)}</div>
            </div>
          </Popover>
        </div>
      {/if}
      {#if bookCard.id === hoveringBookId}
        <div
          tabindex="0"
          role="button"
          class="mdc-elevation--z2 hover:mdc-elevation--z8 mdc-elevation-transition absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-400"
          on:click={() => dispatch('removeBookClick', { id: bookCard.id })}
          on:keyup={dummyFn}
        >
          <svg role="img" class="w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 504 504">
            <path
              class="fill-current text-white"
              d="M369.6 313.1c4.7 4.7 4.7 12.3 0 17L330 369.6c-4.7 4.7-12.3 4.7-17 0L248 304l-65.1 65.6c-4.7 4.7-12.3 4.7-17 0L126.4 330c-4.7-4.7-4.7-12.3 0-17l65.6-65-65.6-65.1c-4.7-4.7-4.7-12.3 0-17l39.6-39.6c4.7-4.7 12.3-4.7 17 0l65 65.7 65.1-65.6c4.7-4.7 12.3-4.7 17 0l39.6 39.6c4.7 4.7 4.7 12.3 0 17L304 248l65.6 65.1z"
            />
          </svg>
        </div>
      {/if}
    </div>
  {/each}
</div>
