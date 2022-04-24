<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookmark as fasBookmark,
    faExpand,
    faCog,
    faSignOutAlt
  } from '@fortawesome/free-solid-svg-icons';
  import {
    nTranslateXHeaderFa,
    opacityHeaderIcon,
    pHeaderFa,
    translateXHeaderFa
  } from '$lib/css-classes';

  export let autoScrollMultiplier: number;
  export let showFullscreenButton: boolean;

  export let isBookmarkScreen: boolean;

  const dispatch = createEventDispatcher<{
    bookmarkClick: void;
    fullscreenClick: void;
    bookManagerClick: void;
    settingsClick: void;
  }>();
</script>

<div class="flex h-12 justify-between bg-gray-700 px-4 text-white md:px-8 xl:h-10">
  <div class="flex transform-gpu {nTranslateXHeaderFa}">
    <div
      class="flex h-full items-center text-xl xl:text-lg {pHeaderFa} {opacityHeaderIcon} cursor-pointer"
      on:click={() => dispatch('bookmarkClick')}
      role="button"
    >
      <Fa icon={isBookmarkScreen ? fasBookmark : farBookmark} />
    </div>
    <div class="flex items-center px-4 text-xl xl:px-3 xl:text-lg">{autoScrollMultiplier}x</div>
  </div>

  <div class="flex transform-gpu {translateXHeaderFa}">
    {#if showFullscreenButton}
      <div
        role="button"
        on:click={() => dispatch('fullscreenClick')}
        class="flex h-full items-center text-xl xl:text-lg {pHeaderFa} {opacityHeaderIcon} cursor-pointer"
      >
        <Fa icon={faExpand} />
      </div>
    {/if}
    <a on:click={() => dispatch('settingsClick')} href="/settings">
      <span
        class="flex h-full items-center text-xl xl:text-lg {pHeaderFa} {opacityHeaderIcon} cursor-pointer"
      >
        <Fa icon={faCog} />
      </span>
    </a>
    <a on:click={() => dispatch('bookManagerClick')} href="/manage">
      <span
        class="flex h-full items-center text-xl xl:text-lg {pHeaderFa} {opacityHeaderIcon} cursor-pointer"
      >
        <Fa icon={faSignOutAlt} />
      </span>
    </a>
  </div>
</div>
