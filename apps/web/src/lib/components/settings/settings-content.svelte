<script lang="ts">
  import { browser } from '$app/environment';
  import { faComputer, faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import {
    TrackerAutoPause,
    TrackerSkipThresholdAction
  } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import {
    optionsForToggle,
    type ToggleOption
  } from '$lib/components/button-toggle-group/toggle-option';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import SettingsCustomTheme from '$lib/components/settings/settings-custom-theme.svelte';
  import SettingsDimensionPopover from '$lib/components/settings/settings-dimension-popover.svelte';
  import SettingsFontSelector from '$lib/components/settings/settings-font-selector.svelte';
  import SettingsReadingGoals from '$lib/components/settings/settings-reading-goals.svelte';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import SettingsStorageSourceList from '$lib/components/settings/settings-storage-source-list.svelte';
  import SettingsUserFontDialog from '$lib/components/settings/settings-user-font-dialog.svelte';
  import { inputClasses } from '$lib/css-classes';
  import { BlurMode } from '$lib/data/blur-mode';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { LocalFont } from '$lib/data/fonts';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import { logger } from '$lib/data/logger';
  import { MergeMode } from '$lib/data/merge-mode';
  import { isAppDefault } from '$lib/data/storage/storage-source-manager';
  import { defaultStorageSources } from '$lib/data/storage/storage-types';
  import { isStorageSourceAvailable } from '$lib/data/storage/storage-view';
  import {
    customThemes$,
    database,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    horizontalCustomReadingPosition$,
    textMarginMode$,
    textMarginValue$,
    theme$,
    verticalCustomReadingPosition$
  } from '$lib/data/store';
  import type { TextMarginMode } from '$lib/data/text-margin-mode';
  import { availableThemes as availableThemesMap } from '$lib/data/theme-option';
  import { ViewMode } from '$lib/data/view-mode';
  import type { WritingMode } from '$lib/data/writing-mode';
  import { secondsToMinutes } from '$lib/functions/statistic-util';
  import { dummyFn } from '$lib/functions/utils';
  import {
    ReplicationSaveBehavior,
    AutoReplicationType
  } from '$lib/functions/replication/replication-options';
  import { map } from 'rxjs';
  import Fa from 'svelte-fa';
  import { onDestroy } from 'svelte';

  export let selectedTheme: string;

  export let viewMode: ViewMode;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let fontSize: number;

  export let lineHeight: number;

  export let textIndentation: number;

  export let textMarginValue: number;

  export let blurImage: boolean;

  export let blurImageMode: string;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let writingMode: WritingMode;

  export let prioritizeReaderStyles: boolean;

  export let enableTextJustification: boolean;

  export let enableTextWrapPretty: boolean;

  export let textMarginMode: TextMarginMode;

  export let enableReaderWakeLock: boolean;

  export let showCharacterCounter: boolean;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let swipeThreshold: number;

  export let disableWheelNavigation: boolean;

  export let autoPositionOnResize: boolean;

  export let avoidPageBreak: boolean;

  export let pauseTrackerOnCustomPointChange: boolean;

  export let customReadingPointEnabled: boolean;

  export let selectionToBookmarkEnabled: boolean;

  export let enableTapEdgeToFlip: boolean;

  export let pageColumns: number;

  export let storageQuota: string;

  export let persistentStorage: boolean;

  export let confirmClose: boolean;

  export let manualBookmark: boolean;

  export let autoBookmark: boolean;

  export let autoBookmarkTime: number;

  export let activeSettings: string;

  export let cacheStorageData: boolean;

  export let autoReplication: string;

  export let replicationSaveBehavior: string;

  export let showExternalPlaceholder: boolean;

  export let keepLocalStatisticsOnDeletion: boolean;

  export let overwriteBookCompletion: boolean;

  export let startDayHoursForTracker: number;

  export let statisticsMergeMode: string;

  export let readingGoalsMergeMode: string;

  export let statisticsEnabled: boolean;

  export let trackerAutoPause: string;

  export let openTrackerOnCompletion: boolean;

  export let addCharactersOnCompletion: boolean;

  export let trackerAutoStartTime: number;

  export let trackerIdleTime: number;

  export let trackerForwardSkipThreshold: number;

  export let trackerBackwardSkipThreshold: number;

  export let trackerSkipThresholdAction: string;

  export let trackerPopupDetection: boolean;

  export let adjustStatisticsAfterIdleTime: boolean;

  $: availableThemes = (
    browser
      ? [...Array.from(availableThemesMap.entries()), ...Object.entries($customThemes$)]
      : Array.from(availableThemesMap.entries())
  ).map(([theme, option]) => ({
    theme,
    option
  }));

  $: optionsForTheme = availableThemes.map(({ theme, option }) => ({
    id: theme,
    text: 'ぁあ',
    style: {
      color: option.fontColor,
      'background-color': option.backgroundColor
    },
    thickBorders: true,
    showIcons: true
  }));

  onDestroy(() => dialogManager.dialogs$.next([]));

  const optionsForFuriganaStyle: ToggleOption<FuriganaStyle>[] = [
    {
      id: FuriganaStyle.Hide,
      text: 'Hide'
    },
    {
      id: FuriganaStyle.Partial,
      text: 'Partial'
    },
    {
      id: FuriganaStyle.Toggle,
      text: 'Toggle'
    },
    {
      id: FuriganaStyle.Full,
      text: 'Full'
    }
  ];

  const optionsForWritingMode: ToggleOption<WritingMode>[] = [
    {
      id: 'horizontal-tb',
      text: 'Horizontal'
    },
    {
      id: 'vertical-rl',
      text: 'Vertical'
    }
  ];

  const optionsForTextMarginMode: ToggleOption<TextMarginMode>[] = [
    {
      id: 'auto',
      text: 'Auto'
    },
    {
      id: 'manual',
      text: 'Manual'
    }
  ];

  const optionsForViewMode: ToggleOption<ViewMode>[] = [
    {
      id: ViewMode.Continuous,
      text: 'Continuous'
    },
    {
      id: ViewMode.Paginated,
      text: 'Paginated'
    }
  ];

  const optionsForBlurMode: ToggleOption<BlurMode>[] = [
    {
      id: BlurMode.ALL,
      text: 'All'
    },
    {
      id: BlurMode.AFTER_TOC,
      text: 'After ToC'
    }
  ];

  const optionsForAutoReplicationType: ToggleOption<AutoReplicationType>[] = [
    {
      id: AutoReplicationType.Off,
      text: 'Off'
    },
    {
      id: AutoReplicationType.Up,
      text: 'Up'
    },
    {
      id: AutoReplicationType.Down,
      text: 'Down'
    },
    {
      id: AutoReplicationType.All,
      text: 'All'
    }
  ];

  const optionsForReplicationSaveBehavior: ToggleOption<ReplicationSaveBehavior>[] = [
    {
      id: ReplicationSaveBehavior.NewOnly,
      text: 'New Only'
    },
    {
      id: ReplicationSaveBehavior.Overwrite,
      text: 'Overwrite'
    }
  ];

  const optionsForTrackerAutoPause: ToggleOption<TrackerAutoPause>[] = [
    {
      id: TrackerAutoPause.OFF,
      text: 'Off'
    },
    {
      id: TrackerAutoPause.MODERATE,
      text: 'Moderate'
    },
    {
      id: TrackerAutoPause.STRICT,
      text: 'Strict'
    }
  ];

  const optionsForTrackerSkipThresholdAction: ToggleOption<TrackerSkipThresholdAction>[] = [
    {
      id: TrackerSkipThresholdAction.IGNORE,
      text: 'Ignore'
    },
    {
      id: TrackerSkipThresholdAction.PAUSE,
      text: 'Pause Tracker'
    }
  ];

  const optionsForMergeMode: ToggleOption<MergeMode>[] = [
    {
      id: MergeMode.MERGE,
      text: 'Merge'
    },
    {
      id: MergeMode.REPLACE,
      text: 'Replace'
    }
  ];

  const storageSources$ = database.storageSourcesChanged$.pipe(
    map((storageSources) => [
      ...defaultStorageSources
        .filter((defaultStorageSource) =>
          isStorageSourceAvailable(defaultStorageSource.type, defaultStorageSource.name, window)
        )
        .map((defaultStorageSource) => ({
          name: defaultStorageSource.name,
          type: defaultStorageSource.type,
          storedInManager: false,
          encryptionDisabled: false,
          data: new ArrayBuffer(0),
          lastSourceModified: 0
        })),
      ...storageSources.filter((storageSource) => !isAppDefault(storageSource.name))
    ])
  );

  let showSpinner = false;
  let furiganaStyleTooltip = '';
  let autoReplicationTypeTooltip = '';
  let trackerAutoPauseTooltip = '';

  $: if ($textMarginMode$ === 'auto') {
    $textMarginValue$ = 0;
  }

  $: autoBookmarkTooltip = `If enabled sets a bookmark after ${autoBookmarkTime} seconds without scrolling/page change`;
  $: wakeLockSupported = browser && 'wakeLock' in navigator;
  $: verticalMode = writingMode === 'vertical-rl';
  $: fontCacheSupported = browser && 'caches' in window;
  $: switch (furiganaStyle) {
    case FuriganaStyle.Hide:
      furiganaStyleTooltip = 'Always hidden';
      break;
    case FuriganaStyle.Toggle:
      furiganaStyleTooltip = 'Hidden by default, can be toggled on click';
      break;
    case FuriganaStyle.Full:
      furiganaStyleTooltip = 'Hidden by default, show on hover or click';
      break;
    default:
      furiganaStyleTooltip = 'Display furigana as grayed out text';
      break;
  }
  $: avoidPageBreakTooltip = avoidPageBreak
    ? 'Avoids breaking words/sentences into different pages'
    : 'Allow words/sentences to break into different pages';
  $: persistentStorageTooltip = persistentStorage
    ? 'Reader uses higher storage limit for local data'
    : 'Uses lower temporary storage for local data.\nMay require bookmark or notification permissions for enablement';
  $: cacheStorageDataTooltip = cacheStorageData
    ? 'Storage data is cached. Saves network traffic/latency but requires to reload current/open a new tab to retrieve data changes'
    : 'Storage data is refetched on every action. May consume more network traffic/latency but ensures current data';
  $: replicationSaveBehaviorTooltip =
    replicationSaveBehavior === ReplicationSaveBehavior.Overwrite
      ? 'Data will always be overwritten'
      : 'Data will only be written if none exist on target, no time data is present or if target data is older';
  $: switch (autoReplication) {
    case AutoReplicationType.Up:
      autoReplicationTypeTooltip =
        'Updated data will be exported to sync target when reading once per minute';
      break;
    case AutoReplicationType.Down:
      autoReplicationTypeTooltip = 'Data will be imported from sync target when opening a book';
      break;
    case AutoReplicationType.All:
      autoReplicationTypeTooltip = 'Data will be synced in both directions';
      break;
    default:
      autoReplicationTypeTooltip = 'No automatic import/export of data';
      break;
  }
  $: showExternalPlaceholderToolTip = showExternalPlaceholder
    ? 'Placeholder data for external books is shown in the browser source manager'
    : 'Placeholder data for external books is hidden';

  $: startOfDayHours = `${`${startDayHoursForTracker}`.padStart(2, '0')}:00`;

  $: trackerIdleTimeInMin = secondsToMinutes(trackerIdleTime);

  $: switch (trackerAutoPause) {
    case TrackerAutoPause.OFF:
      trackerAutoPauseTooltip = 'Tracker does not auto pause except for certain reader events';
      break;
    case TrackerAutoPause.STRICT:
      trackerAutoPauseTooltip =
        'Tracker will auto pause on certain reader events and any kind of site focus loss (e. g. dictionary popup)';
      break;
    default:
      trackerAutoPauseTooltip =
        'Tracker will auto pause on certain reader events and when the reader tab loses focus';
      break;
  }

  $: if ((activeSettings === 'Data' || activeSettings === 'Statistics') && !$storageSources$) {
    database
      .getStorageSources()
      .then((storageSources) => {
        database.storageSourcesChanged$.next(storageSources);
      })
      .catch((error) => {
        logger.error(`Failed to retrieve storage sources: ${error.message}`);
        database.storageSourcesChanged$.next([]);
      });
  }
</script>

<div class="grid grid-cols-1 items-center sm:grid-cols-2 sm:gap-6 lg:md:gap-8 lg:grid-cols-3">
  {#if activeSettings === 'Reader'}
    <div class="lg:col-span-2">
      <SettingsItemGroup title="Theme">
        <ButtonToggleGroup
          options={optionsForTheme}
          bind:selectedOptionId={selectedTheme}
          on:edit={({ detail }) =>
            dialogManager.dialogs$.next([
              {
                component: SettingsCustomTheme,
                props: { selectedTheme: detail, existingThemes: optionsForTheme }
              }
            ])}
          on:delete={({ detail }) => {
            $theme$ = optionsForTheme[optionsForTheme.length - 2]?.id || 'light-theme';
            delete $customThemes$[detail];
            $customThemes$ = { ...$customThemes$ };
          }}
        >
          {#if browser}
            <button
              class="m-1 rounded-md border-2 border-gray-400 p-2 text-lg"
              on:click={() =>
                dialogManager.dialogs$.next([
                  {
                    component: SettingsCustomTheme,
                    props: { existingThemes: optionsForTheme }
                  }
                ])}
            >
              <Fa icon={faPlus} class="mx-2" />
              <Ripple />
            </button>
          {/if}
        </ButtonToggleGroup>
      </SettingsItemGroup>
    </div>
    <div class="h-full">
      <SettingsItemGroup title="View mode">
        <ButtonToggleGroup options={optionsForViewMode} bind:selectedOptionId={viewMode} />
      </SettingsItemGroup>
    </div>
    <SettingsItemGroup title="Font family (Group 1)">
      <div slot="header" class="flex items-center">
        <SettingsFontSelector
          availableFonts={[
            LocalFont.NOTOSERIFJP,
            LocalFont.KZUDMINCHO,
            LocalFont.GENEI,
            LocalFont.SHIPPORIMINCHO,
            LocalFont.KLEEONE,
            LocalFont.KLEEONESEMIBOLD,
            LocalFont.SERIF
          ]}
          bind:fontValue={fontFamilyGroupOne}
        />
        {#if fontCacheSupported}
          <div
            tabindex="0"
            role="button"
            title="Open Custom Font Dialog"
            on:click={() =>
              dialogManager.dialogs$.next([
                {
                  component: SettingsUserFontDialog,
                  props: { fontFamily: fontFamilyGroupOne$ }
                }
              ])}
            on:keyup={dummyFn}
          >
            <Fa icon={faComputer} />
          </div>
        {/if}
      </div>
      <input
        type="text"
        class={inputClasses}
        placeholder="Noto Serif JP"
        bind:value={fontFamilyGroupOne}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Font family (Group 2)">
      <div slot="header" class="flex items-center">
        <SettingsFontSelector
          availableFonts={[LocalFont.NOTOSANSJP, LocalFont.KZUDGOTHIC, LocalFont.SANSSERIF]}
          bind:fontValue={fontFamilyGroupTwo}
        />
        {#if fontCacheSupported}
          <div
            tabindex="0"
            role="button"
            on:click={() =>
              dialogManager.dialogs$.next([
                {
                  component: SettingsUserFontDialog,
                  props: { fontFamily: fontFamilyGroupTwo$ }
                }
              ])}
            on:keyup={dummyFn}
          >
            <Fa icon={faComputer} />
          </div>
        {/if}
      </div>
      <input
        type="text"
        class={inputClasses}
        placeholder="Noto Sans JP"
        bind:value={fontFamilyGroupTwo}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Font size">
      <input type="number" class={inputClasses} step="1" min="1" bind:value={fontSize} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Line Height">
      <input
        type="number"
        class={inputClasses}
        step="0.05"
        min="1"
        bind:value={lineHeight}
        on:change={() => {
          if (!lineHeight || lineHeight < 1) {
            lineHeight = 1.65;
          }
        }}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Paragraph Indentation"
      tooltip="# of rem added as text indentation of new paragraphs"
    >
      <input
        type="number"
        class={inputClasses}
        step=".5"
        min="0"
        bind:value={textIndentation}
        on:blur={() => {
          const newValue = Number.parseFloat(`${textIndentation ?? 0}`);

          if (isNaN(newValue) || newValue < 1) {
            textIndentation = 0;
          }
        }}
      />
    </SettingsItemGroup>
    {#if textMarginMode === 'manual'}
      <SettingsItemGroup title="Paragraph Margins" tooltip="# of rem added as margin to paragraphs">
        <input
          type="number"
          class={inputClasses}
          step=".5"
          min="0"
          bind:value={textMarginValue}
          on:blur={() => {
            const newValue = Number.parseFloat(`${textMarginValue ?? 0}`);

            if (isNaN(newValue) || newValue < 1) {
              textMarginValue = 0;
            }
          }}
        />
      </SettingsItemGroup>
    {/if}
    <SettingsItemGroup
      title={verticalMode ? 'Reader Left/right margin' : 'Reader Top/bottom margin'}
    >
      <SettingsDimensionPopover
        slot="header"
        isFirstDimension
        isVertical={verticalMode}
        bind:dimensionValue={firstDimensionMargin}
      />
      <input
        type="number"
        class={inputClasses}
        step="1"
        min="0"
        bind:value={firstDimensionMargin}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title={verticalMode ? 'Reader Max height' : 'Reader Max width'}>
      <SettingsDimensionPopover
        slot="header"
        isVertical={verticalMode}
        bind:dimensionValue={secondDimensionMaxValue}
      />
      <input
        type="number"
        class={inputClasses}
        step="1"
        min="0"
        bind:value={secondDimensionMaxValue}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Swipe Threshold"
      tooltip={'Distance which you need to swipe in order trigger a navigation'}
    >
      <input
        type="number"
        step="1"
        min="10"
        class={inputClasses}
        bind:value={swipeThreshold}
        on:blur={() => {
          if (swipeThreshold < 10 || typeof swipeThreshold !== 'number') {
            swipeThreshold = 10;
          }
        }}
      />
    </SettingsItemGroup>
    {#if autoBookmark}
      <SettingsItemGroup title="Auto Bookmark Time" tooltip={'Time in s for Auto Bookmark'}>
        <input
          type="number"
          step="1"
          min="1"
          class={inputClasses}
          bind:value={autoBookmarkTime}
          on:blur={() => {
            if (autoBookmarkTime < 1 || typeof autoBookmarkTime !== 'number') {
              autoBookmarkTime = 3;
            }
          }}
        />
      </SettingsItemGroup>
    {/if}
    <SettingsItemGroup title="Writing mode">
      <ButtonToggleGroup options={optionsForWritingMode} bind:selectedOptionId={writingMode} />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Prioritize Reader Styles"
      tooltip={'When enabled the "important" declaration is added to certain rules like margins or justification which makes it more likely to be applied in case of conflicting book styles'}
    >
      <ButtonToggleGroup
        options={optionsForToggle}
        bind:selectedOptionId={prioritizeReaderStyles}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Enable Text Justification"
      tooltip={'When enabled the reader adds styles to justify text content of paragraphs'}
    >
      <ButtonToggleGroup
        options={optionsForToggle}
        bind:selectedOptionId={enableTextJustification}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Enable Pretty Text Wrap"
      tooltip={'When enabled the reader adds the pretty text wrap style to supported browsers'}
    >
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={enableTextWrapPretty} />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Paragraph Margin Mode"
      tooltip={'When set to manual it allows to specify a margin value which should be applied to paragraphs'}
    >
      <ButtonToggleGroup
        options={optionsForTextMarginMode}
        bind:selectedOptionId={textMarginMode}
      />
    </SettingsItemGroup>
    {#if wakeLockSupported}
      <SettingsItemGroup
        title="Enable Screen Lock"
        tooltip={'When enabled the reader site attempts to request a WakeLock that prevents device screens from dimming or locking'}
      >
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={enableReaderWakeLock}
        />
      </SettingsItemGroup>
    {/if}
    <SettingsItemGroup title="Show Character Counter">
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={showCharacterCounter} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Disable Wheel Navigation">
      <ButtonToggleGroup
        options={optionsForToggle}
        bind:selectedOptionId={disableWheelNavigation}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Close Confirmation"
      tooltip={`When enabled asks for confirmation on closing/reloading a reader tab and unsaved changes were detected`}
    >
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={confirmClose} />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Manual Bookmark"
      tooltip={'If enabled current position will not be bookmarked when leaving the reader via menu elements'}
    >
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={manualBookmark} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Auto Bookmark" tooltip={autoBookmarkTooltip}>
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={autoBookmark} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Blur image">
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={blurImage} />
    </SettingsItemGroup>
    {#if blurImage}
      <SettingsItemGroup
        title="Blur Mode"
        tooltip="Determines if all or only images after the table of contents will be blurred"
      >
        <ButtonToggleGroup options={optionsForBlurMode} bind:selectedOptionId={blurImageMode} />
      </SettingsItemGroup>
    {/if}
    <SettingsItemGroup title="Hide furigana">
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={hideFurigana} />
    </SettingsItemGroup>
    {#if hideFurigana}
      <SettingsItemGroup title="Hide furigana style" tooltip={furiganaStyleTooltip}>
        <ButtonToggleGroup
          options={optionsForFuriganaStyle}
          bind:selectedOptionId={furiganaStyle}
        />
      </SettingsItemGroup>
    {/if}
    {#if statisticsEnabled}
      <SettingsItemGroup
        title="Custom Point pauses Tracker"
        tooltip={'When enabled the tracker will auto pause and unpause while setting a custom reading point'}
      >
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={pauseTrackerOnCustomPointChange}
        />
      </SettingsItemGroup>
    {/if}
    {#if viewMode === ViewMode.Continuous}
      <SettingsItemGroup
        title="Custom Reading Point"
        tooltip={'Allows to set a persistent custom point in the reader from which the current progress and bookmark is calculated when enabled'}
      >
        <div class="flex items-center">
          <ButtonToggleGroup
            options={optionsForToggle}
            bind:selectedOptionId={customReadingPointEnabled}
          />
          {#if customReadingPointEnabled}
            <div
              tabindex="0"
              role="button"
              class="ml-4 hover:underline"
              on:click={() => {
                verticalCustomReadingPosition$.next(100);
                horizontalCustomReadingPosition$.next(0);
              }}
              on:keyup={dummyFn}
            >
              Reset Points
            </div>
          {/if}
        </div>
      </SettingsItemGroup>
      <SettingsItemGroup title="Auto position on resize">
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={autoPositionOnResize}
        />
      </SettingsItemGroup>
    {:else}
      <SettingsItemGroup title="Avoid Page Break" tooltip={avoidPageBreakTooltip}>
        <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={avoidPageBreak} />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Selection to Bookmark"
        tooltip={'When enabled bookmarks will be placed to a near paragraph of current/previous selected text instead of page start'}
      >
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={selectionToBookmarkEnabled}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Tap to Flip"
        tooltip="Reserves small margins on the left and right on which you can tap to turn pages"
      >
        <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={enableTapEdgeToFlip} />
      </SettingsItemGroup>
      {#if !verticalMode}
        <SettingsItemGroup title="Page Columns" tooltip="# of text columns rendered">
          <input type="number" class={inputClasses} step="1" min="0" bind:value={pageColumns} />
        </SettingsItemGroup>
      {/if}
    {/if}
  {:else if activeSettings === 'Data'}
    <SettingsItemGroup title="Persistent storage" tooltip={persistentStorageTooltip}>
      <div class="flex items-center">
        <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={persistentStorage} />
        {#if storageQuota}
          <div class="ml-4">{storageQuota}</div>
        {/if}
      </div>
    </SettingsItemGroup>
    <SettingsItemGroup title="Cache Data" tooltip={cacheStorageDataTooltip}>
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={cacheStorageData} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Auto Import/Export" tooltip={autoReplicationTypeTooltip}>
      <ButtonToggleGroup
        options={optionsForAutoReplicationType}
        bind:selectedOptionId={autoReplication}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Import/Export Behavior" tooltip={replicationSaveBehaviorTooltip}>
      <ButtonToggleGroup
        options={optionsForReplicationSaveBehavior}
        bind:selectedOptionId={replicationSaveBehavior}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Show Placeholder" tooltip={showExternalPlaceholderToolTip}>
      <ButtonToggleGroup
        options={optionsForToggle}
        bind:selectedOptionId={showExternalPlaceholder}
      />
    </SettingsItemGroup>
    <SettingsStorageSourceList storageSources={$storageSources$} />
  {:else}
    <SettingsItemGroup
      title="Keep Local Data on Deletion"
      tooltip={'Determines if local statistics will be deleted or not when removing a local book copy'}
    >
      <div class="flex items-center">
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={keepLocalStatisticsOnDeletion}
        />
        <div
          tabindex="0"
          role="button"
          class="ml-4 hover:underline"
          on:click={() => {
            showSpinner = true;
            database
              .clearZombieStatistics()
              .catch(({ message }) =>
                dialogManager.dialogs$.next([
                  {
                    component: MessageDialog,
                    props: {
                      title: 'Error',
                      message: `Error clearing Zombie Statistics: ${message}`
                    }
                  }
                ])
              )
              .finally(() => (showSpinner = false));
          }}
          on:keyup={() => {}}
        >
          Clear Zombie Statistics
        </div>
      </div>
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Overwrite Book Completion"
      tooltip={`Determines if only the first Book Completion will be tracked or if it always updates to the latest one`}
    >
      <ButtonToggleGroup
        options={optionsForToggle}
        bind:selectedOptionId={overwriteBookCompletion}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title={`Start Day Hours: ${startOfDayHours}`}
      tooltip={'Determines at which time a new day starts.\nData before this point will be counted towards the previous day'}
    >
      <input
        type="range"
        step="1"
        min="0"
        max="23"
        class={inputClasses}
        bind:value={startDayHoursForTracker}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Statistics Merge"
      tooltip={`Determines if statistics will be merged entry by entry or replaced completely on a sync`}
    >
      <ButtonToggleGroup
        options={optionsForMergeMode}
        bind:selectedOptionId={statisticsMergeMode}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Reading Goals Merge"
      tooltip={`Determines if reading goals will be merged entry by entry or replaced completely on a sync`}
    >
      <ButtonToggleGroup
        options={optionsForMergeMode}
        bind:selectedOptionId={readingGoalsMergeMode}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Enable Statistics"
      tooltip="Enables the tracker icon in the bottom left corner of the reader which you need to use to start tracking your reading session"
    >
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={statisticsEnabled} />
    </SettingsItemGroup>
    {#if statisticsEnabled}
      <SettingsItemGroup title="Tracker Auto Pause" tooltip={trackerAutoPauseTooltip}>
        <ButtonToggleGroup
          options={optionsForTrackerAutoPause}
          bind:selectedOptionId={trackerAutoPause}
        />
      </SettingsItemGroup>
      <SettingsItemGroup title="Open Tracker on Completion">
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={openTrackerOnCompletion}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Update on Completion"
        tooltip={`Determines if the missing amount of characters between the current position and the book total will be added to the statistics or not`}
      >
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={addCharactersOnCompletion}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Autostart tracker (sec)"
        tooltip={'Time in seconds without a change to the character count after which the tracker will initially auto start (0 = disabled, higher value recommended to avoid racing conditions)'}
      >
        <input
          type="number"
          class={inputClasses}
          step="1"
          min="0"
          bind:value={trackerAutoStartTime}
          on:blur={() => {
            const newValue = Number.parseFloat(`${trackerAutoStartTime ?? 0}`);

            if (isNaN(newValue) || newValue < 1) {
              trackerAutoStartTime = 0;
            }
          }}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Idle Time (min)"
        tooltip={'Time in minutes after which the tracker will auto pause without page interaction (0 = disabled, max 12h)'}
      >
        <input
          type="number"
          class={inputClasses}
          step="0.5"
          min="0"
          bind:value={trackerIdleTimeInMin}
          on:blur={() => {
            if (!trackerIdleTimeInMin || trackerIdleTimeInMin < 0) {
              trackerIdleTime = 0;
            } else if (trackerIdleTimeInMin > 43200) {
              trackerIdleTime = 900;
            } else {
              trackerIdleTime = Math.floor(trackerIdleTimeInMin * 60);
            }
          }}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Forward Skip Threshold"
        tooltip={'Amount of positive characters passed between a tick after which a threshold action is triggered (0 = disabled)'}
      >
        <input
          type="number"
          class={inputClasses}
          step="1"
          min="0"
          bind:value={trackerForwardSkipThreshold}
          on:blur={() => {
            if (trackerForwardSkipThreshold === 0) {
              trackerForwardSkipThreshold = 0;
            } else if (!trackerForwardSkipThreshold || trackerForwardSkipThreshold < 0) {
              trackerForwardSkipThreshold = 2700;
            }
          }}
        />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Backward Skip Threshold"
        tooltip={'Amount of negative characters passed between a tick after which a threshold action is triggered (0 = disabled)'}
      >
        <input
          type="number"
          class={inputClasses}
          step="1"
          bind:value={trackerBackwardSkipThreshold}
          on:blur={() => {
            if (trackerBackwardSkipThreshold < 0) {
              trackerBackwardSkipThreshold = Math.abs(trackerBackwardSkipThreshold);
            } else if (trackerBackwardSkipThreshold === 0) {
              trackerBackwardSkipThreshold = 0;
            } else if (!trackerBackwardSkipThreshold) {
              trackerBackwardSkipThreshold = 2700;
            }
          }}
        />
      </SettingsItemGroup>
      {#if trackerForwardSkipThreshold || trackerBackwardSkipThreshold}
        <SettingsItemGroup
          title="Threshold Action"
          tooltip={`Determines what action will be executed in case a skip threshold was triggered`}
        >
          <ButtonToggleGroup
            options={optionsForTrackerSkipThresholdAction}
            bind:selectedOptionId={trackerSkipThresholdAction}
          />
        </SettingsItemGroup>
      {/if}
      {#if trackerAutoPause !== TrackerAutoPause.OFF}
        <SettingsItemGroup
          title="Dictionary Detection"
          tooltip={`If enabled auto pause is skipped if open yomitan/jpdb-browser-reader was detected - yomitan requires disabled 'Secure Container' settings`}
        >
          <ButtonToggleGroup
            options={optionsForToggle}
            bind:selectedOptionId={trackerPopupDetection}
          />
        </SettingsItemGroup>
      {/if}
      {#if trackerIdleTime > 0}
        <SettingsItemGroup
          title="Rollback Statistics on Idle"
          tooltip={`If enabled attempts to rollback statistics by subtracting the idled time value back from the session`}
        >
          <ButtonToggleGroup
            options={optionsForToggle}
            bind:selectedOptionId={adjustStatisticsAfterIdleTime}
          />
        </SettingsItemGroup>
      {/if}
      <SettingsReadingGoals
        storageSources={$storageSources$}
        on:spinner={({ detail }) => (showSpinner = detail)}
      />
    {/if}
  {/if}
  {#if showSpinner}
    <div class="tap-highlight-transparent fixed inset-0 bg-black/[.2]" />
    <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
      <Fa icon={faSpinner} spin />
    </div>
  {/if}
</div>
