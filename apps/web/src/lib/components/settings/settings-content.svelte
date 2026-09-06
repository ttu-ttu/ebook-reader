<script lang="ts">
  import { browser } from '$app/environment';
  import { faComputer, faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';
  import {
    TrackerAutoPause,
    TrackerSkipThresholdAction
  } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import SettingsCustomTheme from '$lib/components/settings/settings-custom-theme.svelte';
  import SettingsDimensionPopover from '$lib/components/settings/settings-dimension-popover.svelte';
  import SettingsReadingGoals from '$lib/components/settings/settings-reading-goals.svelte';
  import SettingsStorageSourceList from '$lib/components/settings/settings-storage-source-list.svelte';
  import SettingsUserFontDialog from '$lib/components/settings/settings-user-font-dialog.svelte';
  import {
    Button,
    IconButton,
    Input,
    ListItem,
    ListSection,
    SegmentedControl,
    Select,
    Slider,
    Switch,
    Tooltip
  } from '@custom-ereader/ui';
  import { BlurMode } from '$lib/data/blur-mode';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { LocalFont } from '$lib/data/fonts';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import { ImportHTMLFixMode } from '$lib/data/import-html-fix-mode';
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
  import type { VerticalTextOrientation } from '$lib/data/vertical-text-orientation';
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

  export let fontWeight: number | null;

  export let fontSize: number;

  export let lineHeight: number;

  export let textIndentation: number;

  export let textMarginValue: number;

  export let blurImage: boolean;

  export let blurImageMode: string;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let writingMode: WritingMode;

  export let enableFontKerning: boolean;

  export let enableFontVPAL: boolean;

  export let verticalTextOrientation: VerticalTextOrientation;

  export let prioritizeReaderStyles: boolean;

  export let enableTextJustification: boolean;

  export let enableTextWrapPretty: boolean;

  export let textMarginMode: TextMarginMode;

  export let enableReaderWakeLock: boolean;

  export let showCharacterCounter: boolean;

  export let showPercentage: boolean;

  export let showFooterChapterCharacterCounter: boolean;

  export let showFooterChapterPercentage: boolean;

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

  export let hideExternalReadHint: boolean;

  export let confirmClose: boolean;

  export let manualBookmark: boolean;

  export let autoBookmark: boolean;

  export let autoBookmarkTime: number;

  export let autosaveHistoryEnabled: boolean;

  export let autosaveHistoryInterval: number;

  export let autosaveHistoryMaxCount: number;

  export let activeSettings: string;

  export let importHTMLFixMode: string;

  export let restrictImportFixToAnchor: boolean;

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

  $: currentThemeOption = availableThemes.find(({ theme }) => theme === selectedTheme)?.option;

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

  const optionsForVerticalTextOrientation: ToggleOption<VerticalTextOrientation>[] = [
    {
      id: 'mixed',
      text: 'Mixed'
    },
    {
      id: 'upright',
      text: 'Upright'
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

  const optionsForImportHTMLFixes: ToggleOption<ImportHTMLFixMode>[] = [
    {
      id: ImportHTMLFixMode.OFF,
      text: 'Off'
    },
    {
      id: ImportHTMLFixMode.STANDARD,
      text: 'Standard'
    },
    {
      id: ImportHTMLFixMode.EXTENDED,
      text: 'Extended'
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

  const fontGroupOneOptions = [
    { value: LocalFont.NOTOSERIFJP, label: 'Noto Serif JP' },
    { value: LocalFont.KZUDMINCHO, label: 'KzUDMincho' },
    { value: LocalFont.GENEI, label: 'Genei Koburi Mincho' },
    { value: LocalFont.SHIPPORIMINCHO, label: 'Shippori Mincho' },
    { value: LocalFont.KLEEONE, label: 'Klee One' },
    { value: LocalFont.KLEEONESEMIBOLD, label: 'Klee One SemiBold' },
    { value: LocalFont.SERIF, label: 'Generic Serif' }
  ];

  const fontGroupTwoOptions = [
    { value: LocalFont.NOTOSANSJP, label: 'Noto Sans JP' },
    { value: LocalFont.KZUDGOTHIC, label: 'KzUDGothic' },
    { value: LocalFont.SANSSERIF, label: 'Generic Sans-Serif' }
  ];

  $: selectGroupOneOptions = [
    ...(!fontGroupOneOptions.some((f) => f.value === fontFamilyGroupOne) && fontFamilyGroupOne
      ? [{ value: fontFamilyGroupOne, label: `${fontFamilyGroupOne} (Custom)` }]
      : []),
    ...fontGroupOneOptions
  ];

  $: selectGroupTwoOptions = [
    ...(!fontGroupTwoOptions.some((f) => f.value === fontFamilyGroupTwo) && fontFamilyGroupTwo
      ? [{ value: fontFamilyGroupTwo, label: `${fontFamilyGroupTwo} (Custom)` }]
      : []),
    ...fontGroupTwoOptions
  ];

  const segmentsForWritingMode = optionsForWritingMode.map((o) => ({ value: o.id, label: o.text }));
  const segmentsForViewMode = optionsForViewMode.map((o) => ({ value: o.id, label: o.text }));
  const segmentsForVerticalTextOrientation = optionsForVerticalTextOrientation.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForTextMarginMode = optionsForTextMarginMode.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForBlurMode = optionsForBlurMode.map((o) => ({ value: o.id, label: o.text }));
  const segmentsForFuriganaStyle = optionsForFuriganaStyle.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForImportHTMLFixes = optionsForImportHTMLFixes.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForAutoReplicationType = optionsForAutoReplicationType.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForReplicationSaveBehavior = optionsForReplicationSaveBehavior.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForTrackerAutoPause = optionsForTrackerAutoPause.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForTrackerSkipThresholdAction = optionsForTrackerSkipThresholdAction.map((o) => ({
    value: o.id,
    label: o.text
  }));
  const segmentsForMergeMode = optionsForMergeMode.map((o) => ({
    value: o.id,
    label: o.text
  }));

  const sampleJapanese =
    '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。';
  const sampleDialogue =
    '「本当に行くのかい？」「ええ、もう決めたの」風が木々を揺らし、二人の間に微かな沈黙が流れた。夜空には満天の星が瞬いていた。';
  const sampleEnglish =
    'The quick brown fox jumps over the lazy dog. Reading is to the mind what exercise is to the body. Books are a uniquely portable magic.';

  const segmentsForPreviewWritingMode = [
    { value: 'horizontal-tb', label: '横書き' },
    { value: 'vertical-rl', label: '縦書き' }
  ];

  let previewText = sampleJapanese;
  let previewWritingMode: WritingMode = writingMode;
  let previousWritingMode: WritingMode = writingMode;
  $: if (writingMode !== previousWritingMode) {
    previewWritingMode = writingMode;
    previousWritingMode = writingMode;
  }

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
  let importHTMLFixModeTooltip = '';
  let autoReplicationTypeTooltip = '';
  let trackerAutoPauseTooltip = '';

  $: if ($textMarginMode$ === 'auto') {
    $textMarginValue$ = 0;
  }

  $: verticalTextOrientationTooltip =
    verticalTextOrientation === 'mixed'
      ? 'Rotates the characters of horizontal scripts 90° clockwise'
      : 'Lays out the characters of horizontal scripts naturally (upright), as well as the glyphs for vertical scripts.';
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
  $: switch (importHTMLFixMode) {
    case ImportHTMLFixMode.OFF:
      importHTMLFixModeTooltip = 'Imports epub files as is';
      break;
    case ImportHTMLFixMode.EXTENDED:
      importHTMLFixModeTooltip =
        'Applies additional fixes for epub imports like removing control characters, replacing html entities etc.';
      break;
    default:
      importHTMLFixModeTooltip =
        'Applies fixes for epub imports like wrong self closing elements etc.';
      break;
  }
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

<div class="flex flex-col gap-6 max-w-3xl mx-auto pb-16" class:hidden={activeSettings !== 'Reader'}>
  <!-- Section 1: Appearance & Theme -->
  <ListSection
    title="Appearance & Themes"
    description="Customize reading color palettes, contrast, and spoiler image blur"
  >
    <ListItem
      layout="stacked"
      headline="Theme Palette"
      description="Select an active reader color palette or create and customize new themes"
    >
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
            type="button"
            title="Create new custom theme"
            aria-label="Create new custom theme"
            class="inline-flex items-center justify-center h-[38px] px-3.5 rounded-md border border-dashed transition-opacity cursor-pointer text-sm hover:opacity-80"
            style="color: var(--astryx-color-fg-primary, inherit); border-color: var(--astryx-color-border-strong, #71717a); background-color: var(--astryx-color-surface-subtle, transparent);"
            on:click={() =>
              dialogManager.dialogs$.next([
                {
                  component: SettingsCustomTheme,
                  props: { existingThemes: optionsForTheme }
                }
              ])}
          >
            <Fa icon={faPlus} class="mx-1" />
            <Ripple />
          </button>
        {/if}
      </ButtonToggleGroup>
    </ListItem>

    <ListItem
      headline="Blur Spoiler Images"
      description="Blurs book illustrations and covers to avoid spoilers while reading"
    >
      <Switch slot="suffix" bind:checked={blurImage} />
    </ListItem>

    {#if blurImage}
      <ListItem
        layout="stacked"
        headline="Blur Scope"
        description="Determines whether to blur all images or only those appearing after the Table of Contents"
      >
        <SegmentedControl
          fullWidth
          size="sm"
          options={segmentsForBlurMode}
          bind:value={blurImageMode}
        />
      </ListItem>
    {/if}
  </ListSection>

  <!-- Section 2: Layout & Direction -->
  <ListSection
    title="Layout & Reading Modes"
    description="Configure page progression flow, Japanese orientation, and column layouts"
  >
    <ListItem
      layout="stacked"
      headline="Page Progression Mode"
      description="Switch between continuous vertical scrolling and column-based pagination"
    >
      <SegmentedControl fullWidth size="sm" options={segmentsForViewMode} bind:value={viewMode} />
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Writing Direction"
      description="Toggle between vertical (縦書き) and horizontal (横書き) text orientation"
    >
      <SegmentedControl
        fullWidth
        size="sm"
        options={segmentsForWritingMode}
        bind:value={writingMode}
      />
    </ListItem>

    {#if !verticalMode && viewMode === ViewMode.Paginated}
      <ListItem
        headline="Page Columns"
        description="Number of text columns rendered in horizontal paginated view (0 = automatic)"
      >
        <div slot="suffix" class="w-28">
          <Input type="number" size="sm" min="0" step="1" bind:value={pageColumns}>
            <span slot="suffix" class="text-xs text-zinc-500">cols</span>
          </Input>
        </div>
      </ListItem>
    {/if}

    {#if wakeLockSupported}
      <ListItem
        headline="Prevent Screen Sleep (Wake Lock)"
        description="Requests a device wake lock to prevent the screen from dimming while reading"
      >
        <Switch slot="suffix" bind:checked={enableReaderWakeLock} />
      </ListItem>
    {/if}
  </ListSection>

  <!-- Section 3: Typography & Fonts -->
  <ListSection
    title="Typography & Fonts"
    description="Choose reading typefaces, font scales, line heights, and paragraph spacing"
  >
    <ListItem
      layout="stacked"
      headline="Primary Font Family (Mincho / Serif)"
      description="Default Japanese serif typeface for book text. Select preset or enter custom font"
    >
      <div slot="suffix" class="flex items-center gap-1">
        {#if fontCacheSupported}
          <Tooltip text="Manage Installed Web Fonts">
            <IconButton
              variant="ghost"
              size="sm"
              label="Manage Installed Web Fonts"
              on:click={() =>
                dialogManager.dialogs$.next([
                  {
                    component: SettingsUserFontDialog,
                    props: { fontFamily: fontFamilyGroupOne$ }
                  }
                ])}
            >
              <Fa icon={faComputer} />
            </IconButton>
          </Tooltip>
        {/if}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
        <Select size="sm" options={selectGroupOneOptions} bind:value={fontFamilyGroupOne} />
        <Input
          size="sm"
          placeholder="Custom font name (e.g. Noto Serif JP)"
          bind:value={fontFamilyGroupOne}
        />
      </div>
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Secondary Font Family (Gothic / Sans-Serif)"
      description="Secondary Japanese sans-serif typeface for interface, sidebars, and annotations"
    >
      <div slot="suffix" class="flex items-center gap-1">
        {#if fontCacheSupported}
          <Tooltip text="Manage Installed Web Fonts">
            <IconButton
              variant="ghost"
              size="sm"
              label="Manage Installed Web Fonts"
              on:click={() =>
                dialogManager.dialogs$.next([
                  {
                    component: SettingsUserFontDialog,
                    props: { fontFamily: fontFamilyGroupTwo$ }
                  }
                ])}
            >
              <Fa icon={faComputer} />
            </IconButton>
          </Tooltip>
        {/if}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
        <Select size="sm" options={selectGroupTwoOptions} bind:value={fontFamilyGroupTwo} />
        <Input
          size="sm"
          placeholder="Custom font name (e.g. Noto Sans JP)"
          bind:value={fontFamilyGroupTwo}
        />
      </div>
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Font Size"
      description="Base reading font size across all text"
    >
      <span
        slot="suffix"
        class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 tabular-nums"
      >
        {fontSize}px
      </span>
      <Slider min={10} max={48} step={1} bind:value={fontSize} showValue={false} />
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Line Height"
      description="Vertical spacing multiplier between lines of text"
    >
      <span
        slot="suffix"
        class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 tabular-nums"
      >
        {Number(lineHeight).toFixed(2)}x
      </span>
      <Slider min={1.0} max={2.5} step={0.05} bind:value={lineHeight} showValue={false} />
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Example Text Preview"
      description="Live preview reflecting current font size, line height, typeface, and weight"
    >
      <div slot="suffix" class="flex items-center gap-1.5">
        <SegmentedControl
          size="sm"
          options={segmentsForPreviewWritingMode}
          bind:value={previewWritingMode}
        />
      </div>

      <div class="mt-2 flex flex-col gap-2 w-full">
        <div
          contenteditable="true"
          role="textbox"
          tabindex="0"
          aria-multiline="true"
          aria-label="Editable font preview text"
          bind:textContent={previewText}
          class="live-font-preview w-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4 transition-[font-size,line-height] outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 select-text cursor-text box-border"
          style:font-size={`${fontSize}px`}
          style:line-height={`${lineHeight}`}
          style:font-family={fontFamilyGroupOne ? `"${fontFamilyGroupOne}", serif` : 'serif'}
          style:font-weight={fontWeight ? `${fontWeight}` : 'inherit'}
          style:font-kerning={enableFontKerning ? 'normal' : 'none'}
          style:font-feature-settings={enableFontVPAL ? '"vpal"' : 'normal'}
          style:writing-mode={previewWritingMode}
          style:height={previewWritingMode === 'vertical-rl' ? '210px' : 'auto'}
          style:min-height={previewWritingMode === 'vertical-rl' ? '210px' : '84px'}
          style:max-height={previewWritingMode === 'vertical-rl' ? '240px' : '300px'}
          style:overflow-x={previewWritingMode === 'vertical-rl' ? 'auto' : 'hidden'}
          style:overflow-y={previewWritingMode === 'vertical-rl' ? 'hidden' : 'auto'}
          style:background-color={currentThemeOption?.backgroundColor ??
            'var(--astryx-color-surface-subtle, rgba(0, 0, 0, 0.03))'}
          style:color={currentThemeOption?.fontColor ?? 'var(--astryx-color-fg-primary, inherit)'}
        />

        <div
          class="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 px-0.5"
        >
          <span>Click text above to test custom words or kanji</span>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="hover:underline hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              on:click={() => (previewText = sampleJapanese)}
            >
              吾輩は猫 (JA)
            </button>
            <span>•</span>
            <button
              type="button"
              class="hover:underline hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              on:click={() => (previewText = sampleDialogue)}
            >
              Dialogue
            </button>
            <span>•</span>
            <button
              type="button"
              class="hover:underline hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              on:click={() => (previewText = sampleEnglish)}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </ListItem>

    <ListItem
      headline="Font Weight"
      description="Custom font weight override (100–1000). Leave empty for font default"
    >
      <div slot="suffix" class="w-32">
        <Input
          type="number"
          size="sm"
          placeholder="Default"
          step={100}
          min={100}
          max={1000}
          bind:value={fontWeight}
          on:change={() => {
            if (fontWeight === null) return;
            if (fontWeight < 100) fontWeight = 100;
            else if (fontWeight > 1000) fontWeight = 1000;
          }}
        />
      </div>
    </ListItem>

    <ListItem
      headline="Paragraph Indentation"
      description="Indentation added to the first line of paragraphs in rem units"
    >
      <div slot="suffix" class="w-28">
        <Input
          type="number"
          size="sm"
          step={0.5}
          min={0}
          bind:value={textIndentation}
          on:blur={() => {
            const newValue = Number.parseFloat(`${textIndentation ?? 0}`);
            if (isNaN(newValue) || newValue < 0) textIndentation = 0;
          }}
        >
          <span slot="suffix" class="text-xs text-zinc-500">rem</span>
        </Input>
      </div>
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Paragraph Margin Mode"
      description="Whether to use automated margin spacing or custom manual spacing"
    >
      <SegmentedControl
        fullWidth
        size="sm"
        options={segmentsForTextMarginMode}
        bind:value={textMarginMode}
      />
    </ListItem>

    {#if textMarginMode === 'manual'}
      <ListItem
        headline="Paragraph Margins"
        description="Additional margin space added between paragraphs in rem units"
      >
        <div slot="suffix" class="w-28">
          <Input
            type="number"
            size="sm"
            step={0.5}
            min={0}
            bind:value={textMarginValue}
            on:blur={() => {
              const newValue = Number.parseFloat(`${textMarginValue ?? 0}`);
              if (isNaN(newValue) || newValue < 0) textMarginValue = 0;
            }}
          >
            <span slot="suffix" class="text-xs text-zinc-500">rem</span>
          </Input>
        </div>
      </ListItem>
    {/if}
  </ListSection>

  <!-- Section 4: Reader Margins & Boundaries -->
  <ListSection
    title="Reader Margins & Viewport Boundaries"
    description="Configure reading column boundaries and viewport clearance"
  >
    <ListItem
      headline={verticalMode ? 'Reader Left / Right Margin' : 'Reader Top / Bottom Margin'}
      description="Padding distance from viewport edges in pixels"
    >
      <div slot="suffix" class="flex items-center gap-2">
        <SettingsDimensionPopover
          isFirstDimension
          isVertical={verticalMode}
          bind:dimensionValue={firstDimensionMargin}
        />
        <div class="w-28">
          <Input type="number" size="sm" step={1} min={0} bind:value={firstDimensionMargin}>
            <span slot="suffix" class="text-xs text-zinc-500">px</span>
          </Input>
        </div>
      </div>
    </ListItem>

    <ListItem
      headline={verticalMode ? 'Reader Max Height' : 'Reader Max Width'}
      description="Maximum reading dimension boundary before constraining text flow"
    >
      <div slot="suffix" class="flex items-center gap-2">
        <SettingsDimensionPopover
          isVertical={verticalMode}
          bind:dimensionValue={secondDimensionMaxValue}
        />
        <div class="w-28">
          <Input type="number" size="sm" step={1} min={0} bind:value={secondDimensionMaxValue}>
            <span slot="suffix" class="text-xs text-zinc-500">px</span>
          </Input>
        </div>
      </div>
    </ListItem>
  </ListSection>

  <!-- Section 5: Text Rendering & Furigana -->
  <ListSection
    title="Text Rendering & Furigana"
    description="Japanese typography rules, spacing adjustments, and ruby annotations"
  >
    <ListItem
      headline="Prioritize Reader Styles"
      description="Applies '!important' to user font and margin styles to override conflicting book styles"
    >
      <Switch slot="suffix" bind:checked={prioritizeReaderStyles} />
    </ListItem>

    <ListItem
      headline="Enable Text Justification"
      description="Justifies paragraph text content for clean alignment across reading columns"
    >
      <Switch slot="suffix" bind:checked={enableTextJustification} />
    </ListItem>

    <ListItem
      headline="Enable Pretty Text Wrap"
      description="Applies pretty text wrap algorithm to prevent orphan words on supported browsers"
    >
      <Switch slot="suffix" bind:checked={enableTextWrapPretty} />
    </ListItem>

    {#if verticalMode}
      <ListItem
        headline="Enable Vertical Font Kerning"
        description="Improves vertical glyph spacing balance if supported by the font and browser"
      >
        <Switch slot="suffix" bind:checked={enableFontKerning} />
      </ListItem>

      <ListItem
        headline="Enable VPAL (Vertical Proportional Spacing)"
        description="Provides natural proportional spacing for vertical Japanese text layout"
      >
        <Switch slot="suffix" bind:checked={enableFontVPAL} />
      </ListItem>

      <ListItem
        layout="stacked"
        headline="Vertical Text Orientation"
        description={verticalTextOrientationTooltip}
      >
        <SegmentedControl
          fullWidth
          size="sm"
          options={segmentsForVerticalTextOrientation}
          bind:value={verticalTextOrientation}
        />
      </ListItem>
    {/if}

    <ListItem
      headline="Hide Furigana"
      description="Hides Japanese ruby pronunciation glosses above kanji characters"
    >
      <Switch slot="suffix" bind:checked={hideFurigana} />
    </ListItem>

    {#if hideFurigana}
      <ListItem
        layout="stacked"
        headline="Furigana Interaction Style"
        description={furiganaStyleTooltip}
      >
        <SegmentedControl
          fullWidth
          size="sm"
          options={segmentsForFuriganaStyle}
          bind:value={furiganaStyle}
        />
      </ListItem>
    {/if}
  </ListSection>

  <!-- Section 6: Navigation, Gestures & Page Turns -->
  <ListSection
    title="Navigation, Gestures & Page Turns"
    description="Touch gestures, keyboard/mouse controls, and navigation safety"
  >
    <ListItem
      headline="Swipe Navigation Threshold"
      description="Minimum swipe distance in pixels required to trigger a page turn"
    >
      <div slot="suffix" class="w-28">
        <Input
          type="number"
          size="sm"
          step={1}
          min={10}
          bind:value={swipeThreshold}
          on:blur={() => {
            if (swipeThreshold < 10 || typeof swipeThreshold !== 'number') {
              swipeThreshold = 10;
            }
          }}
        >
          <span slot="suffix" class="text-xs text-zinc-500">px</span>
        </Input>
      </div>
    </ListItem>

    {#if viewMode === ViewMode.Paginated}
      <ListItem
        headline="Tap Edge to Flip"
        description="Reserves small margin zones on the left and right edges for quick page flipping"
      >
        <Switch slot="suffix" bind:checked={enableTapEdgeToFlip} />
      </ListItem>

      <ListItem headline="Avoid Mid-Sentence Page Breaks" description={avoidPageBreakTooltip}>
        <Switch slot="suffix" bind:checked={avoidPageBreak} />
      </ListItem>

      <ListItem
        headline="Selection to Bookmark"
        description="Places bookmarks at the nearest selected text paragraph instead of the page top"
      >
        <Switch slot="suffix" bind:checked={selectionToBookmarkEnabled} />
      </ListItem>
    {:else}
      <ListItem
        headline="Auto Reposition on Resize"
        description="Automatically preserves current reading position when the window is resized"
      >
        <Switch slot="suffix" bind:checked={autoPositionOnResize} />
      </ListItem>

      <ListItem
        headline="Custom Reading Anchor Point"
        description="Calculates progress and bookmarks from a persistent viewport anchor line"
      >
        <div slot="suffix" class="flex items-center gap-3">
          {#if customReadingPointEnabled}
            <Button
              variant="ghost"
              size="sm"
              on:click={() => {
                verticalCustomReadingPosition$.next(100);
                horizontalCustomReadingPosition$.next(0);
              }}
            >
              Reset Points
            </Button>
          {/if}
          <Switch bind:checked={customReadingPointEnabled} />
        </div>
      </ListItem>

      {#if statisticsEnabled}
        <ListItem
          headline="Pause Tracker While Setting Anchor"
          description="Auto-pauses the reading statistics timer while dragging the custom anchor point"
        >
          <Switch slot="suffix" bind:checked={pauseTrackerOnCustomPointChange} />
        </ListItem>
      {/if}
    {/if}

    <ListItem
      headline="Disable Mouse Wheel Navigation"
      description="Prevents flipping pages using the mouse scroll wheel"
    >
      <Switch slot="suffix" bind:checked={disableWheelNavigation} />
    </ListItem>

    <ListItem
      headline="Confirm Before Leaving Tab"
      description="Prompts for confirmation when closing or refreshing reader tab if unsaved changes were detected"
    >
      <Switch slot="suffix" bind:checked={confirmClose} />
    </ListItem>
  </ListSection>

  <!-- Section 7: Bookmarks, Autosave & Progress -->
  <ListSection
    title="Bookmarks, Autosaves & Progress"
    description="Position checkpoints, rolling autosaves, and reader indicators"
  >
    <ListItem
      headline="Manual Bookmark Only"
      description="Prevents automatically updating bookmark position when leaving the reader via menu"
    >
      <Switch slot="suffix" bind:checked={manualBookmark} />
    </ListItem>

    <ListItem headline="Auto-Bookmark Position" description={autoBookmarkTooltip}>
      <Switch slot="suffix" bind:checked={autoBookmark} />
    </ListItem>

    {#if autoBookmark}
      <ListItem
        headline="Auto-Bookmark Delay"
        description="Seconds idle on a page before saving an automatic bookmark"
      >
        <div slot="suffix" class="w-28">
          <Input
            type="number"
            size="sm"
            step={1}
            min={1}
            bind:value={autoBookmarkTime}
            on:blur={() => {
              if (autoBookmarkTime < 1 || typeof autoBookmarkTime !== 'number') {
                autoBookmarkTime = 3;
              }
            }}
          >
            <span slot="suffix" class="text-xs text-zinc-500">s</span>
          </Input>
        </div>
      </ListItem>
    {/if}

    <ListItem
      headline="Rolling Autosave History"
      description="Preserves rolling position checkpoints while reading so you can recover your place after accidental rapid scrolling"
    >
      <Switch slot="suffix" bind:checked={autosaveHistoryEnabled} />
    </ListItem>

    {#if autosaveHistoryEnabled}
      <ListItem
        headline="Autosave Pause Delay"
        description="Seconds stopped on a page without scrolling before saving a rolling checkpoint (1–30s)"
      >
        <div slot="suffix" class="w-28">
          <Input
            type="number"
            size="sm"
            step={1}
            min={1}
            max={30}
            bind:value={autosaveHistoryInterval}
            on:blur={() => {
              if (autosaveHistoryInterval < 1 || typeof autosaveHistoryInterval !== 'number') {
                autosaveHistoryInterval = 3;
              }
            }}
          >
            <span slot="suffix" class="text-xs text-zinc-500">s</span>
          </Input>
        </div>
      </ListItem>

      <ListItem
        headline="Max Autosaves to Retain"
        description="Number of rolling autosave checkpoints to preserve before pruning older entries (2–20)"
      >
        <div slot="suffix" class="w-28">
          <Input
            type="number"
            size="sm"
            step={1}
            min={2}
            max={20}
            bind:value={autosaveHistoryMaxCount}
            on:blur={() => {
              if (autosaveHistoryMaxCount < 2 || typeof autosaveHistoryMaxCount !== 'number') {
                autosaveHistoryMaxCount = 10;
              } else if (autosaveHistoryMaxCount > 20) {
                autosaveHistoryMaxCount = 20;
              }
            }}
          >
            <span slot="suffix" class="text-xs text-zinc-500">items</span>
          </Input>
        </div>
      </ListItem>
    {/if}

    <ListItem
      headline="Show Character Counter"
      description="Displays current character position and total character count in reader header/footer"
    >
      <Switch slot="suffix" bind:checked={showCharacterCounter} />
    </ListItem>

    <ListItem
      headline="Show Book Percentage"
      description="Displays overall book completion percentage"
    >
      <Switch slot="suffix" bind:checked={showPercentage} />
    </ListItem>

    <ListItem
      headline="Show Footer Chapter Characters"
      description="Displays characters read within the current chapter in reader footer"
    >
      <Switch slot="suffix" bind:checked={showFooterChapterCharacterCounter} />
    </ListItem>

    <ListItem
      headline="Show Footer Chapter Percentage"
      description="Displays progress percentage within current chapter in reader footer"
    >
      <Switch slot="suffix" bind:checked={showFooterChapterPercentage} />
    </ListItem>
  </ListSection>
</div>
<div class="flex flex-col gap-6 max-w-3xl mx-auto pb-16" class:hidden={activeSettings !== 'Data'}>
  <!-- Section 1: Local Storage & Caching -->
  <ListSection
    title="Local Storage & Caching"
    description="Manage local storage persistence, quota, and offline caching"
  >
    <ListItem headline="Persistent Storage" description={persistentStorageTooltip}>
      <div slot="suffix" class="flex items-center gap-3">
        {#if storageQuota}
          <span
            class="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono"
          >
            {storageQuota}
          </span>
        {/if}
        <Switch bind:checked={persistentStorage} />
      </div>
    </ListItem>

    <ListItem headline="Cache Storage Data" description={cacheStorageDataTooltip}>
      <Switch slot="suffix" bind:checked={cacheStorageData} />
    </ListItem>
  </ListSection>

  <!-- Section 2: Book Import & Display -->
  <ListSection
    title="Book Import & Display"
    description="Configure EPUB import sanitization and browser source indicators"
  >
    <ListItem layout="stacked" headline="EPUB Import Fixes" description={importHTMLFixModeTooltip}>
      <SegmentedControl
        options={segmentsForImportHTMLFixes}
        bind:value={importHTMLFixMode}
        size="sm"
      />
    </ListItem>

    {#if importHTMLFixMode !== ImportHTMLFixMode.OFF}
      <ListItem
        headline="Restrict Fixes to Links"
        description="Restricts EPUB fixes for self-closing tags to anchor links only"
      >
        <Switch slot="suffix" bind:checked={restrictImportFixToAnchor} />
      </ListItem>
    {/if}

    <ListItem
      headline="Hide External Source Hint"
      description="Hides the warning notification when opening a book from an external storage source"
    >
      <Switch slot="suffix" bind:checked={hideExternalReadHint} />
    </ListItem>

    <ListItem
      headline="Show External Books Placeholder"
      description={showExternalPlaceholderToolTip}
    >
      <Switch slot="suffix" bind:checked={showExternalPlaceholder} />
    </ListItem>
  </ListSection>

  <!-- Section 3: Synchronization & Auto-Replication -->
  <ListSection
    title="Synchronization & Auto-Replication"
    description="Automatic background syncing between reader and connected storage targets"
  >
    <ListItem
      layout="stacked"
      headline="Auto Import/Export Direction"
      description={autoReplicationTypeTooltip}
    >
      <SegmentedControl
        options={segmentsForAutoReplicationType}
        bind:value={autoReplication}
        size="sm"
      />
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Import/Export Save Behavior"
      description={replicationSaveBehaviorTooltip}
    >
      <SegmentedControl
        options={segmentsForReplicationSaveBehavior}
        bind:value={replicationSaveBehavior}
        size="sm"
      />
    </ListItem>
  </ListSection>

  <!-- Section 4: Storage Sources -->
  <SettingsStorageSourceList storageSources={$storageSources$} />
</div>
<div
  class="flex flex-col gap-6 max-w-3xl mx-auto pb-16"
  class:hidden={activeSettings !== 'Statistics'}
>
  <!-- Section 1: Reading Tracker -->
  <ListSection
    title="Reading Tracker"
    description="Track reading time, reading speed, and character progress across sessions"
  >
    <ListItem
      headline="Enable Reading Tracker"
      description="Enables the tracker control in the reader to track reading sessions and calculate reading statistics"
    >
      <Switch slot="suffix" bind:checked={statisticsEnabled} />
    </ListItem>

    {#if statisticsEnabled}
      <ListItem
        layout="stacked"
        headline="Tracker Auto-Pause"
        description={trackerAutoPauseTooltip}
      >
        <SegmentedControl
          options={segmentsForTrackerAutoPause}
          bind:value={trackerAutoPause}
          size="sm"
        />
      </ListItem>

      {#if trackerAutoPause !== TrackerAutoPause.OFF}
        <ListItem
          headline="Dictionary Popup Detection"
          description="Skips auto-pause if an open Yomitan or JPDB popup is detected (requires Yomitan 'Secure Container' disabled)"
        >
          <Switch slot="suffix" bind:checked={trackerPopupDetection} />
        </ListItem>
      {/if}

      <ListItem
        headline="Open Tracker on Book Completion"
        description="Automatically presents the reading statistics summary when finishing a book"
      >
        <Switch slot="suffix" bind:checked={openTrackerOnCompletion} />
      </ListItem>

      <ListItem
        headline="Update on Book Completion"
        description="Adds the remaining unread characters to statistics when marking a book complete"
      >
        <Switch slot="suffix" bind:checked={addCharactersOnCompletion} />
      </ListItem>

      <ListItem
        headline="Autostart Delay"
        description="Seconds without character count changes after which tracker initially auto-starts (0 = disabled)"
      >
        <div slot="suffix" class="w-28">
          <Input
            type="number"
            size="sm"
            step={1}
            min={0}
            bind:value={trackerAutoStartTime}
            on:blur={() => {
              const newValue = Number.parseFloat(`${trackerAutoStartTime ?? 0}`);
              if (isNaN(newValue) || newValue < 1) {
                trackerAutoStartTime = 0;
              }
            }}
          >
            <span slot="suffix" class="text-xs text-zinc-500">s</span>
          </Input>
        </div>
      </ListItem>

      <ListItem
        headline="Idle Timeout"
        description="Minutes without reader interaction before auto-pausing (0 = disabled, max 720 min)"
      >
        <div slot="suffix" class="w-28">
          <Input
            type="number"
            size="sm"
            step={0.5}
            min={0}
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
          >
            <span slot="suffix" class="text-xs text-zinc-500">min</span>
          </Input>
        </div>
      </ListItem>

      {#if trackerIdleTime > 0}
        <ListItem
          headline="Rollback Statistics on Idle"
          description="Subtracts the idle timeout duration from reading time once idle pause triggers"
        >
          <Switch slot="suffix" bind:checked={adjustStatisticsAfterIdleTime} />
        </ListItem>
      {/if}
    {/if}
  </ListSection>

  <!-- Section 2: Reading Session Skip Triggers -->
  {#if statisticsEnabled}
    <ListSection
      title="Reading Skip Triggers"
      description="Configure thresholds for detecting rapid jumps forward or backward in text"
    >
      <ListItem
        headline="Forward Skip Threshold"
        description="Positive characters passed in a single tick that triggers a threshold action (0 = disabled)"
      >
        <div slot="suffix" class="w-32">
          <Input
            type="number"
            size="sm"
            step={1}
            min={0}
            bind:value={trackerForwardSkipThreshold}
            on:blur={() => {
              if (trackerForwardSkipThreshold === 0) {
                trackerForwardSkipThreshold = 0;
              } else if (!trackerForwardSkipThreshold || trackerForwardSkipThreshold < 0) {
                trackerForwardSkipThreshold = 2700;
              }
            }}
          >
            <span slot="suffix" class="text-xs text-zinc-500">chars</span>
          </Input>
        </div>
      </ListItem>

      <ListItem
        headline="Backward Skip Threshold"
        description="Negative characters passed in a single tick that triggers a threshold action (0 = disabled)"
      >
        <div slot="suffix" class="w-32">
          <Input
            type="number"
            size="sm"
            step={1}
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
          >
            <span slot="suffix" class="text-xs text-zinc-500">chars</span>
          </Input>
        </div>
      </ListItem>

      {#if trackerForwardSkipThreshold || trackerBackwardSkipThreshold}
        <ListItem
          layout="stacked"
          headline="Threshold Action"
          description="Action executed when a forward or backward skip threshold is exceeded"
        >
          <SegmentedControl
            options={segmentsForTrackerSkipThresholdAction}
            bind:value={trackerSkipThresholdAction}
            size="sm"
          />
        </ListItem>
      {/if}
    </ListSection>
  {/if}

  <!-- Section 3: Database & Synchronization Rules -->
  <ListSection
    title="Database & Sync Rules"
    description="Configure day boundaries, sync conflict resolutions, and local statistics retention"
  >
    <ListItem
      layout="stacked"
      headline="Start Day Hour"
      description="Determines when a new tracking day starts. Reading activity before this point counts towards the previous day."
    >
      <div class="pt-2">
        <Slider
          min={0}
          max={23}
          step={1}
          bind:value={startDayHoursForTracker}
          showValue={true}
          valueFormatter={(val) => `${`${val}`.padStart(2, '0')}:00`}
        />
      </div>
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Statistics Sync Mode"
      description="Determines whether statistics merge entry-by-entry or replace completely during remote sync"
    >
      <SegmentedControl options={segmentsForMergeMode} bind:value={statisticsMergeMode} size="sm" />
    </ListItem>

    <ListItem
      layout="stacked"
      headline="Reading Goals Sync Mode"
      description="Determines whether reading goals merge entry-by-entry or replace completely during remote sync"
    >
      <SegmentedControl
        options={segmentsForMergeMode}
        bind:value={readingGoalsMergeMode}
        size="sm"
      />
    </ListItem>

    <ListItem
      headline="Keep Local Data on Deletion"
      description="Preserves reading statistics and history when removing a local copy of a book"
    >
      <Switch slot="suffix" bind:checked={keepLocalStatisticsOnDeletion} />
    </ListItem>

    <ListItem
      headline="Clear Zombie Statistics"
      description="Prunes orphan reading statistics records for books that no longer exist"
    >
      <div slot="suffix">
        <Button
          variant="secondary"
          size="sm"
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
        >
          Clear Zombies
        </Button>
      </div>
    </ListItem>

    <ListItem
      headline="Overwrite Book Completion"
      description="Determines if only the first book completion date is recorded, or if subsequent finishes update the completion timestamp"
    >
      <Switch slot="suffix" bind:checked={overwriteBookCompletion} />
    </ListItem>
  </ListSection>

  <!-- Section 4: Reading Goals -->
  <SettingsReadingGoals
    storageSources={$storageSources$}
    on:spinner={({ detail }) => (showSpinner = detail)}
  />
</div>
{#if showSpinner}
  <div class="tap-highlight-transparent fixed inset-0 bg-black/[.2]" />
  <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
    <Fa icon={faSpinner} spin />
  </div>
{/if}
