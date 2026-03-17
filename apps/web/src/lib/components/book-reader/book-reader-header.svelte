<script lang="ts">
  import { browser } from '$app/environment';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookmark as fasBookmark,
    faCrosshairs,
    faExpand,
    faFlag,
    faList,
    faRotateLeft,
    type IconDefinition
  } from '@fortawesome/free-solid-svg-icons';
  import { readerImageGalleryPictures$ } from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    baseHeaderClasses,
    baseIconClasses,
    labelIconClasses,
    nTranslateXHeaderFa,
    translateXHeaderFa
  } from '$lib/css-classes';
  import { customReadingPointEnabled$, showHeaderLabels$, viewMode$ } from '$lib/data/store';
  import { ViewMode } from '$lib/data/view-mode';
  import { dummyFn, isMobile$, isOnOldUrl } from '$lib/functions/utils';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let hasChapterData: boolean;
  export let hasText: boolean;
  export let autoScrollMultiplier: number;
  export let hasCustomReadingPoint: boolean;
  export let showFullscreenButton: boolean;
  export let isBookmarkScreen: boolean;
  export let hasBookmarkData: boolean;

  const dispatch = createEventDispatcher<{
    tocClick: void;
    bookmarkClick: void;
    scrollToBookmarkClick: void;
    jumpClick: void;
    completeBook: void;
    fullscreenClick: void;
    showCustomReadingPoint: void;
    setCustomReadingPoint: void;
    resetCustomReadingPoint: void;
    statisticsClick: void;
    readerImageGalleryClick: void;
    settingsClick: void;
    domainHintClick: void;
    bookManagerClick: void;
  }>();

  const customReadingPointMenuItems: {
    label: string;
    action: any;
  }[] = [
    ...(hasCustomReadingPoint ? [{ label: 'Show Point', action: 'showCustomReadingPoint' }] : []),
    { label: 'Set Point', action: 'setCustomReadingPoint' },
    ...(hasCustomReadingPoint ? [{ label: 'Reset Point', action: 'resetCustomReadingPoint' }] : [])
  ];

  let customReadingPointMenuElm: Popover;

  let menuItems: {
    routeId: string;
    label: string;
    icon: IconDefinition;
    title: string;
  }[] = [];

  $: isOldUrl = browser && isOnOldUrl(window);

  $: {
    const items = [];

    if (isOldUrl) {
      items.push(mergeEntries.DOMAIN_HINT);
    } else {
      items.push(mergeEntries.STATISTICS);
    }

    if (hasText) {
      items.push(mergeEntries.JUMP_TO_POSITION);
    }

    if ($readerImageGalleryPictures$.length) {
      items.push(mergeEntries.READER_IMAGE_GALLERY);
    }

    items.push(mergeEntries.SETTINGS, mergeEntries.MANAGE);

    menuItems = items;
  }

  $: iconClasses = $showHeaderLabels$ ? labelIconClasses : baseIconClasses;

  function dispatchCustomReadingPointAction(action: any) {
    dispatch(action);
    customReadingPointMenuElm.toggleOpen();
  }
</script>

<div class="flex justify-between bg-gray-700 px-4 md:px-8 {baseHeaderClasses}">
  <div class="flex transform-gpu {nTranslateXHeaderFa}">
    {#if hasChapterData}
      <div
        tabindex="0"
        role="button"
        title="Open Table of Contents"
        class={iconClasses}
        on:click={() => dispatch('tocClick')}
        on:keyup={dummyFn}
      >
        <Fa icon={faList} class={$showHeaderLabels$ ? 'text-sm xl:text-xs' : ''} />
        {#if $showHeaderLabels$}<span>TOC</span>{/if}
      </div>
    {/if}
    <div
      tabindex="0"
      role="button"
      title="Create Bookmark"
      class={iconClasses}
      on:click={() => dispatch('bookmarkClick')}
      on:keyup={dummyFn}
    >
      <Fa
        icon={isBookmarkScreen ? fasBookmark : farBookmark}
        class={$showHeaderLabels$ ? 'text-sm xl:text-xs' : ''}
      />
      {#if $showHeaderLabels$}<span>Bookmark</span>{/if}
    </div>
    {#if hasBookmarkData}
      <div
        tabindex="0"
        role="button"
        title="Return to Bookmark"
        class={iconClasses}
        on:click={() => dispatch('scrollToBookmarkClick')}
        on:keyup={dummyFn}
      >
        <Fa icon={faRotateLeft} class={$showHeaderLabels$ ? 'text-sm xl:text-xs' : ''} />
        {#if $showHeaderLabels$}<span>Return to Bookmark</span>{/if}
      </div>
    {/if}
    {#if $viewMode$ === ViewMode.Continuous && !$isMobile$}
      <div
        class="flex items-center px-4 text-xl xl:px-3 xl:text-lg"
        title="Current Autoscroll Speed"
      >
        {autoScrollMultiplier}x
      </div>
    {/if}
  </div>

  <div class="flex transform-gpu {translateXHeaderFa}">
    <div
      tabindex="0"
      role="button"
      title="Complete Book"
      class={iconClasses}
      on:click={() => dispatch('completeBook')}
      on:keyup={dummyFn}
    >
      <Fa icon={faFlag} class={$showHeaderLabels$ ? 'text-sm xl:text-xs' : ''} />
      {#if $showHeaderLabels$}<span>Complete Book</span>{/if}
    </div>
    {#if $customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated}
      <div class="flex">
        <Popover
          placement="bottom"
          fallbackPlacements={['bottom-end', 'bottom-start']}
          yOffset={0}
          bind:this={customReadingPointMenuElm}
        >
          <div slot="icon" title="Open Custom Point Actions" class={iconClasses}>
            <Fa icon={faCrosshairs} class={$showHeaderLabels$ ? 'text-sm xl:text-xs' : ''} />
            {#if $showHeaderLabels$}<span>Point</span>{/if}
          </div>
          <div class="w-40 bg-gray-700 md:w-32" slot="content">
            {#each customReadingPointMenuItems as actionItem (actionItem.label)}
              <div
                tabindex="0"
                role="button"
                class="px-4 py-2 text-sm hover:bg-white hover:text-gray-700"
                on:click={() => dispatchCustomReadingPointAction(actionItem.action)}
                on:keyup={dummyFn}
              >
                {actionItem.label}
              </div>
            {/each}
          </div>
        </Popover>
      </div>
    {/if}
    {#if showFullscreenButton}
      <div
        tabindex="0"
        role="button"
        title="Toggle Fullscreen"
        class={iconClasses}
        on:click={() => dispatch('fullscreenClick')}
        on:keyup={dummyFn}
      >
        <Fa icon={faExpand} class={$showHeaderLabels$ ? 'text-sm xl:text-xs' : ''} />
        {#if $showHeaderLabels$}<span>Fullscreen</span>{/if}
      </div>
    {/if}
    <MergedHeaderIcon
      disableRouteNavigation
      items={menuItems}
      on:action={({ detail }) => {
        if (detail === mergeEntries.STATISTICS.label) {
          dispatch('statisticsClick');
        } else if (detail === mergeEntries.JUMP_TO_POSITION.label) {
          dispatch('jumpClick');
        } else if (detail === mergeEntries.READER_IMAGE_GALLERY.label) {
          dispatch('readerImageGalleryClick');
        } else if (detail === mergeEntries.SETTINGS.label) {
          dispatch('settingsClick');
        } else if (detail === mergeEntries.DOMAIN_HINT.label) {
          dispatch('domainHintClick');
        } else if (detail === mergeEntries.MANAGE.label) {
          dispatch('bookManagerClick');
        }
      }}
    />
  </div>
</div>
