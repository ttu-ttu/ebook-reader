<script lang="ts">
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import { faBookmark as fasBookmark, faExpand, faList } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import { createEventDispatcher } from 'svelte';
  import {
    baseHeaderClasses,
    baseIconClasses,
    nTranslateXHeaderFa,
    translateXHeaderFa
  } from '$lib/css-classes';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';

  export let hasChapterData: boolean;
  export let autoScrollMultiplier: number;
  export let showFullscreenButton: boolean;
  export let isBookmarkScreen: boolean;

  const dispatch = createEventDispatcher<{
    tocClick: void;
    bookmarkClick: void;
    fullscreenClick: void;
    bookManagerClick: void;
    settingsClick: void;
  }>();
</script>

<div class="flex justify-between bg-gray-700 px-4 md:px-8 {baseHeaderClasses}">
  <div class="flex transform-gpu {nTranslateXHeaderFa}">
    {#if hasChapterData}
      <div class={baseIconClasses} on:click={() => dispatch('tocClick')} role="button">
        <Fa icon={faList} />
      </div>
    {/if}
    <div class={baseIconClasses} on:click={() => dispatch('bookmarkClick')} role="button">
      <Fa icon={isBookmarkScreen ? fasBookmark : farBookmark} />
    </div>
    <div class="flex items-center px-4 text-xl xl:px-3 xl:text-lg">{autoScrollMultiplier}x</div>
  </div>

  <div class="flex transform-gpu {translateXHeaderFa}">
    {#if showFullscreenButton}
      <div role="button" on:click={() => dispatch('fullscreenClick')} class={baseIconClasses}>
        <Fa icon={faExpand} />
      </div>
    {/if}
    <MergedHeaderIcon
      disableRouteNavigation
      items={[mergeEntries.SETTINGS, mergeEntries.MANAGE]}
      on:action={({ detail }) => {
        if (detail === mergeEntries.SETTINGS.label) {
          dispatch('settingsClick');
        } else if (detail === mergeEntries.MANAGE.label) {
          dispatch('bookManagerClick');
        }
      }}
    />
  </div>
</div>
