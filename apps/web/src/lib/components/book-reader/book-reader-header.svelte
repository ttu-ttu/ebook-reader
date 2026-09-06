<script lang="ts">
  import { browser } from '$app/environment';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookBookmark,
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
  import { IconButton, Tooltip, TopBar } from '@custom-ereader/ui';
  import { customReadingPointEnabled$, viewMode$ } from '$lib/data/store';
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
    bookmarkPanelClick: void;
    createBookmarkClick: void;
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

  let bookmarkPressTimer: any;
  let didLongPress = false;

  function handleBookmarkPointerDown() {
    didLongPress = false;
    bookmarkPressTimer = setTimeout(() => {
      didLongPress = true;
      dispatch('createBookmarkClick');
    }, 500);
  }

  function handleBookmarkPointerUp() {
    clearTimeout(bookmarkPressTimer);
  }

  function handleBookmarkClick() {
    if (didLongPress) {
      didLongPress = false;
      return;
    }
    dispatch('bookmarkClick');
  }

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

  function dispatchCustomReadingPointAction(action: any) {
    dispatch(action);
    customReadingPointMenuElm.toggleOpen();
  }
</script>

<TopBar bordered={true} density="compact" translucent={true}>
  <!-- Left / Start Actions -->
  <div slot="start" class="flex items-center gap-0.5 sm:gap-1">
    {#if hasChapterData}
      <Tooltip text="Open Table of Contents">
        <IconButton
          label="Open Table of Contents"
          size="md"
          variant="ghost"
          on:click={() => dispatch('tocClick')}
        >
          <Fa icon={faList} class="text-base" />
        </IconButton>
      </Tooltip>
    {/if}

    <Tooltip text="Open Bookmarks">
      <IconButton
        label="Open Bookmarks"
        size="md"
        variant="ghost"
        on:click={() => dispatch('bookmarkPanelClick')}
      >
        <Fa icon={faBookBookmark} class="text-base" />
      </IconButton>
    </Tooltip>

    <Tooltip text="Save Position (Hold to Create Named Bookmark)">
      <IconButton
        label="Save Position (Hold to Create Named Bookmark)"
        size="md"
        variant="ghost"
        active={isBookmarkScreen}
        on:pointerdown={handleBookmarkPointerDown}
        on:pointerup={handleBookmarkPointerUp}
        on:contextmenu={(e) => {
          e.preventDefault();
          dispatch('createBookmarkClick');
        }}
        on:click={handleBookmarkClick}
      >
        <Fa icon={isBookmarkScreen ? fasBookmark : farBookmark} class="text-base" />
      </IconButton>
    </Tooltip>

    {#if hasBookmarkData}
      <Tooltip text="Return to Bookmark">
        <IconButton
          label="Return to Bookmark"
          size="md"
          variant="ghost"
          on:click={() => dispatch('scrollToBookmarkClick')}
        >
          <Fa icon={faRotateLeft} class="text-base" />
        </IconButton>
      </Tooltip>
    {/if}

    {#if $viewMode$ === ViewMode.Continuous && !$isMobile$}
      <span
        class="ml-1 flex items-center rounded-full bg-[var(--astryx-color-surface-hover)] px-2 py-0.5 text-xs font-semibold text-[var(--astryx-color-fg-muted)]"
        title="Current Autoscroll Speed"
      >
        {autoScrollMultiplier}x
      </span>
    {/if}
  </div>

  <!-- Right / End Actions -->
  <div slot="end" class="flex items-center gap-0.5 sm:gap-1">
    <Tooltip text="Complete Book">
      <IconButton
        label="Complete Book"
        size="md"
        variant="ghost"
        on:click={() => dispatch('completeBook')}
      >
        <Fa icon={faFlag} class="text-base" />
      </IconButton>
    </Tooltip>

    {#if $customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated}
      <Popover
        placement="bottom"
        fallbackPlacements={['bottom-end', 'bottom-start']}
        yOffset={4}
        bind:this={customReadingPointMenuElm}
      >
        <div
          slot="icon"
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--astryx-radius-md,6px)] text-[var(--astryx-color-fg-muted)] transition-colors hover:bg-[var(--astryx-color-surface-hover)] hover:text-[var(--astryx-color-fg-primary)]"
          title="Open Custom Point Actions"
        >
          <Fa icon={faCrosshairs} class="text-base" />
        </div>
        <div
          class="min-w-[8.5rem] rounded-lg border border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-surface)] py-1 shadow-lg"
          slot="content"
        >
          {#each customReadingPointMenuItems as actionItem (actionItem.label)}
            <div
              tabindex="0"
              role="button"
              class="cursor-pointer px-4 py-2 text-left text-sm text-[var(--astryx-color-fg-primary)] transition-colors hover:bg-[var(--astryx-color-surface-hover)]"
              on:click={() => dispatchCustomReadingPointAction(actionItem.action)}
              on:keyup={dummyFn}
            >
              {actionItem.label}
            </div>
          {/each}
        </div>
      </Popover>
    {/if}

    {#if showFullscreenButton}
      <Tooltip text="Toggle Fullscreen">
        <IconButton
          label="Toggle Fullscreen"
          size="md"
          variant="ghost"
          on:click={() => dispatch('fullscreenClick')}
        >
          <Fa icon={faExpand} class="text-base" />
        </IconButton>
      </Tooltip>
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
</TopBar>
