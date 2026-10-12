<script lang="ts">
  import { browser } from '$app/environment';
  import { faBookmark as farBookmark } from '@fortawesome/free-regular-svg-icons';
  import {
    faBookmark as fasBookmark,
    faBookAtlas,
    faEllipsisVertical,
    faExpand,
    faFlag,
    faHeadphones,
    faList,
    faLocationDot,
    faMagnifyingGlass,
    faMinus,
    faPalette,
    faPlus,
    faRotateLeft,
    type IconDefinition
  } from '@fortawesome/free-solid-svg-icons';
  import AppHeader from '$lib/components/app-header/app-header.svelte';
  import { readerImageGalleryPictures$ } from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import Popover from '$lib/components/popover/popover.svelte';
  import { customReadingPointEnabled$, fontSize$, viewMode$ } from '$lib/data/store';
  import {
    customAppThemes$,
    selectedThemeId$,
    selectTheme,
    themeDefinitions$
  } from '$lib/data/theme/theme-store';
  import { resolveTheme } from '$lib/data/theme/themes';
  import { ViewMode } from '$lib/data/view-mode';
  import { isMobile$, isOnOldUrl } from '$lib/functions/utils';
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
    ttsClick: void;
    searchClick: void;
    companionClick: void;
  }>();

  const customReadingPointMenuItems: {
    label: string;
    action: any;
  }[] = [
    ...(hasCustomReadingPoint ? [{ label: 'Show Point', action: 'showCustomReadingPoint' }] : []),
    { label: 'Set Point', action: 'setCustomReadingPoint' },
    ...(hasCustomReadingPoint ? [{ label: 'Reset Point', action: 'resetCustomReadingPoint' }] : [])
  ];

  const panelClasses = 'app-popover-panel';

  let customReadingPointMenuElm: Popover;
  let moreMenuElm: Popover;

  type HeaderAction = Parameters<typeof dispatch>[0];

  let moreMenuItems: {
    label: string;
    icon: IconDefinition;
    action: HeaderAction;
    classes: string;
  }[] = [];

  $: isOldUrl = browser && isOnOldUrl(window);

  $: themes = ($themeDefinitions$ ?? []).map((definition) =>
    resolveTheme(definition.id, $customAppThemes$)
  );

  $: {
    const item = (
      entry: { label: string; icon: IconDefinition },
      action: HeaderAction,
      classes = ''
    ) => ({
      label: entry.label,
      icon: entry.icon,
      action,
      classes: `app-popover-item ${classes}`
    });
    const items = [];

    // Shown in the bar on larger screens.
    if (hasBookmarkData) {
      items.push(
        item(
          { label: 'Return to Bookmark', icon: faRotateLeft },
          'scrollToBookmarkClick',
          'md:hidden'
        )
      );
    }
    if (showFullscreenButton) {
      items.push(item({ label: 'Fullscreen', icon: faExpand }, 'fullscreenClick', 'md:hidden'));
    }
    // Phones: the bar would push its icons over the back button.
    if (hasText) {
      items.push(
        item({ label: 'Search in Book', icon: faMagnifyingGlass }, 'searchClick', 'sm:hidden')
      );
    }
    items.push(item({ label: 'Listen', icon: faHeadphones }, 'ttsClick', 'sm:hidden'));

    items.push(item({ label: 'Complete Book', icon: faFlag }, 'completeBook'));

    if (hasText) {
      items.push(item(mergeEntries.JUMP_TO_POSITION, 'jumpClick'));
    }

    if ($readerImageGalleryPictures$.length) {
      items.push(item(mergeEntries.READER_IMAGE_GALLERY, 'readerImageGalleryClick'));
    }

    // Larger screens have these in the section navigation.
    items.push(
      isOldUrl
        ? item(mergeEntries.DOMAIN_HINT, 'domainHintClick')
        : item(mergeEntries.STATISTICS, 'statisticsClick', 'sm:hidden'),
      item(mergeEntries.SETTINGS, 'settingsClick', 'sm:hidden'),
      item({ label: 'Library', icon: mergeEntries.MANAGE.icon }, 'bookManagerClick', 'sm:hidden')
    );

    moreMenuItems = items;
  }

  function runMoreAction(action: HeaderAction) {
    moreMenuElm.toggleOpen();
    dispatch(action);
  }

  function dispatchCustomReadingPointAction(action: any) {
    dispatch(action);
    customReadingPointMenuElm.toggleOpen();
  }
</script>

<AppHeader
  active={undefined}
  onNavigate={(section) => {
    if (section === 'statistics') {
      dispatch('statisticsClick');
    } else if (section === 'settings') {
      dispatch('settingsClick');
    } else {
      dispatch('bookManagerClick');
    }
  }}
  onBack={() => dispatch('bookManagerClick')}
>
  {#if hasChapterData}
    <button
      type="button"
      class="app-header-icon"
      title="Open Table of Contents"
      on:click={() => dispatch('tocClick')}
    >
      <Fa icon={faList} />
    </button>
  {/if}
  <button
    type="button"
    class="app-header-icon"
    title="Create Bookmark"
    on:click={() => dispatch('bookmarkClick')}
  >
    <Fa icon={isBookmarkScreen ? fasBookmark : farBookmark} />
  </button>
  {#if hasBookmarkData}
    <button
      type="button"
      class="app-header-icon hidden md:inline-flex"
      title="Return to Bookmark"
      on:click={() => dispatch('scrollToBookmarkClick')}
    >
      <Fa icon={faRotateLeft} />
    </button>
  {/if}
  {#if hasText}
    <button
      type="button"
      class="app-header-icon hidden sm:inline-flex"
      title="Search in Book"
      on:click={() => dispatch('searchClick')}
    >
      <Fa icon={faMagnifyingGlass} />
    </button>
  {/if}
  <button
    type="button"
    class="app-header-icon hidden sm:inline-flex"
    title="Listen: audiobook or AI voice"
    on:click={() => dispatch('ttsClick')}
  >
    <Fa icon={faHeadphones} />
  </button>
  <button
    type="button"
    class="app-header-icon"
    title="Highlights, story so far and lorebook"
    on:click={() => dispatch('companionClick')}
  >
    <Fa icon={faBookAtlas} />
  </button>
  {#if $customReadingPointEnabled$ || $viewMode$ === ViewMode.Paginated}
    <Popover
      placement="bottom"
      fallbackPlacements={['bottom-end', 'bottom-start']}
      yOffset={10}
      {panelClasses}
      bind:this={customReadingPointMenuElm}
    >
      <div slot="icon" class="app-header-icon hidden md:inline-flex" title="Custom Reading Point">
        <Fa icon={faLocationDot} />
      </div>
      <div slot="content" class="flex flex-col">
        {#each customReadingPointMenuItems as actionItem (actionItem.label)}
          <button
            type="button"
            class="app-popover-item"
            on:click={() => dispatchCustomReadingPointAction(actionItem.action)}
          >
            {actionItem.label}
          </button>
        {/each}
      </div>
    </Popover>
  {/if}
  {#if showFullscreenButton}
    <button
      type="button"
      class="app-header-icon hidden md:inline-flex"
      title="Toggle Fullscreen"
      on:click={() => dispatch('fullscreenClick')}
    >
      <Fa icon={faExpand} />
    </button>
  {/if}
  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom', 'bottom-start']}
    yOffset={10}
    {panelClasses}
  >
    <div slot="icon" class="app-header-icon" title="Quick Settings">
      <Fa icon={faPalette} />
    </div>
    <div slot="content" class="flex w-64 flex-col gap-3 p-2">
      <div class="app-popover-heading">Theme</div>
      <div class="flex flex-wrap gap-2 px-2">
        {#each themes as option (option.id)}
          <button
            type="button"
            class="h-9 w-9 rounded-lg border-2 text-sm"
            style:border-color={option.id === $selectedThemeId$
              ? 'var(--accent-color)'
              : 'var(--app-control-border)'}
            style:color={option.colors.readerText}
            style:background-color={option.colors.readerBackground}
            title={option.name}
            on:click={() => selectTheme(option.id)}
          >
            あ
          </button>
        {/each}
      </div>
      <div class="app-popover-heading">Font size</div>
      <div class="flex items-center justify-between px-2 pb-1">
        <button
          type="button"
          class="font-size-button"
          title="Smaller"
          on:click={() => fontSize$.next(Math.max(8, $fontSize$ - 1))}
        >
          <Fa icon={faMinus} />
        </button>
        <span class="font-semibold">{$fontSize$}px</span>
        <button
          type="button"
          class="font-size-button"
          title="Larger"
          on:click={() => fontSize$.next($fontSize$ + 1)}
        >
          <Fa icon={faPlus} />
        </button>
      </div>
    </div>
  </Popover>
  <Popover
    placement="bottom-end"
    fallbackPlacements={['bottom', 'bottom-start']}
    yOffset={10}
    {panelClasses}
    bind:this={moreMenuElm}
  >
    <div slot="icon" class="app-header-icon" title="More reader actions">
      <Fa icon={faEllipsisVertical} />
    </div>
    <div slot="content" class="flex flex-col">
      {#each moreMenuItems as item (item.label)}
        <button type="button" class={item.classes} on:click={() => runMoreAction(item.action)}>
          <Fa icon={item.icon} fw />
          {item.label}
        </button>
      {/each}
    </div>
  </Popover>
  {#if $viewMode$ === ViewMode.Continuous && !$isMobile$}
    <span class="px-2 text-sm font-semibold" title="Current Autoscroll Speed">
      {autoScrollMultiplier}x
    </span>
  {/if}
</AppHeader>

<style>
  .font-size-button {
    display: inline-flex;
    width: 2.25rem;
    height: 2.25rem;
    align-items: center;
    justify-content: center;
    border: 1px solid currentColor;
    border-radius: 0.75rem;
    opacity: 0.8;
  }

  .font-size-button:hover {
    opacity: 1;
  }
</style>
