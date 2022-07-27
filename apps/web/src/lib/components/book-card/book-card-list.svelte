<script lang="ts">
  import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import type { BookCardProps } from './book-card-props';
  import BookCard from './book-card.svelte';

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
</script>

<div class="grid grid-cols-3 justify-between gap-5 pb-4 md:grid-cols-4 lg:grid-cols-5">
  {#each bookCards as bookCard (bookCard.id)}
    <div
      class="relative"
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
            class="absolute inset-0 cursor-pointer bg-gray-700 bg-opacity-20"
            on:click={() => onBookCardClick(bookCard.id)}
          >
            <Fa class="absolute left-2 top-2 flex text-xl text-white" icon={faCheckCircle} />
          </div>
        {/if}
      </div>

      {#if bookCard.id === hoveringBookId}
        <div
          class="mdc-elevation--z2 hover:mdc-elevation--z8 mdc-elevation-transition absolute -top-2 -right-2 h-6 w-6 cursor-pointer rounded-full bg-red-400"
          on:click={() => dispatch('removeBookClick', { id: bookCard.id })}
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
