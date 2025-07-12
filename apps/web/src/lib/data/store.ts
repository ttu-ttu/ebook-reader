/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import { browser } from '$app/environment';
import {
  ReaderImageGalleryAvailableKeybind,
  type ReaderImageGalleryKeybindMap
} from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
import {
  ReadingGoalFrequency,
  TrackerAutoPause,
  TrackerSkipThresholdAction
} from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
import { HeatmapDataAggregration } from '$lib/components/statistics/statistics-heatmap/statistics-heatmap';
import {
  StatisticsRangeTemplate,
  StatisticsTab,
  type BookStatistic,
  StatisticsReadingDataAggregationMode
} from '$lib/components/statistics/statistics-types';
import { BlurMode } from '$lib/data/blur-mode';
import type { UserFont } from '$lib/data/fonts';
import { MergeMode } from '$lib/data/merge-mode';
import type { ReadingGoal } from '$lib/data/reading-goal';
import { SortDirection, type SortOption } from '$lib/data/sort-types';
import {
  StatisticsTabAvailableKeybind,
  type StatisticsTabKeybindMap
} from '$lib/data/statistics-tab-keybind';
import {
  InternalStorageSources,
  StorageDataType,
  StorageKey,
  StorageSourceDefault
} from '$lib/data/storage/storage-types';
import {
  AutoReplicationType,
  ReplicationSaveBehavior
} from '$lib/functions/replication/replication-options';
import { writableSubject } from '$lib/functions/svelte/store';
import { map } from 'rxjs';
import { BookReaderAvailableKeybind, type BookReaderKeybindMap } from './book-reader-keybind';
import { DatabaseService } from './database/books-db/database.service';
import { createBooksDb } from './database/books-db/factory';
import { FuriganaStyle } from './furigana-style';
import { writableBooleanLocalStorageSubject } from './internal/writable-boolean-local-storage-subject';
import { writableNumberLocalStorageSubject } from './internal/writable-number-local-storage-subject';
import {
  writableArrayLocalStorageSubject,
  writableObjectLocalStorageSubject
} from './internal/writable-object-local-storage-subject';
import type { TextMarginMode } from './text-margin-mode';
import type { ThemeOption } from './theme-option';
import { ViewMode } from './view-mode';
import type { WritingMode } from './writing-mode';
import { writableSetLocalStorageSubject } from './internal/writable-set-local-storage-subject';
import { writableStringLocalStorageSubject } from './internal/writable-string-local-storage-subject';

export const theme$ = writableStringLocalStorageSubject()('theme', 'light-theme');
export const customThemes$ = writableObjectLocalStorageSubject<Record<string, ThemeOption>>()(
  'customThemes',
  {}
);
export const multiplier$ = writableNumberLocalStorageSubject()('autoScrollMultiplier', 20);
export const fontFamilyGroupOne$ = writableStringLocalStorageSubject()(
  'fontFamilyGroupOne',
  'Noto Serif JP'
);
export const fontFamilyGroupTwo$ = writableStringLocalStorageSubject()(
  'fontFamilyGroupTwo',
  'Noto Sans JP'
);
export const fontSize$ = writableNumberLocalStorageSubject()('fontSize', 20);
export const lineHeight$ = writableNumberLocalStorageSubject()('lineHeight', 1.65);
export const textIndentation$ = writableNumberLocalStorageSubject()('textIndentation', 0);
export const textMarginValue$ = writableNumberLocalStorageSubject()('textMarginValue', 0);
export const hideSpoilerImage$ = writableBooleanLocalStorageSubject()('hideSpoilerImage', true);
export const hideSpoilerImageMode$ = writableStringLocalStorageSubject<BlurMode>()(
  'hideSpoilerImageMode',
  BlurMode.AFTER_TOC
);
export const hideFurigana$ = writableBooleanLocalStorageSubject()('hideFurigana', false);
export const furiganaStyle$ = writableStringLocalStorageSubject<FuriganaStyle>()(
  'furiganaStyle',
  FuriganaStyle.Partial
);
export const writingMode$ = writableStringLocalStorageSubject<WritingMode>()(
  'writingMode',
  'vertical-rl'
);
export const prioritizeReaderStyles$ = writableBooleanLocalStorageSubject()(
  'prioritizeReaderStyles',
  false
);
export const enableTextJustification$ = writableBooleanLocalStorageSubject()(
  'enableTextJustification',
  false
);
export const enableTextWrapPretty$ = writableBooleanLocalStorageSubject()(
  'enableTextWrapPretty',
  false
);
export const textMarginMode$ = writableStringLocalStorageSubject<TextMarginMode>()(
  'textMarginMode',
  'auto'
);
export const enableReaderWakeLock$ = writableBooleanLocalStorageSubject()(
  'enableReaderWakeLock',
  false
);
export const verticalMode$ = writingMode$.pipe(map((writingMode) => writingMode === 'vertical-rl'));
export const showCharacterCounter$ = writableBooleanLocalStorageSubject()(
  'showCharacterCounter',
  true
);
export const showPercentage$ = writableBooleanLocalStorageSubject()(
  'showPercentage',
  true
);
export const viewMode$ = writableStringLocalStorageSubject<ViewMode>()(
  'viewMode',
  ViewMode.Paginated
);

export const secondDimensionMaxValue$ = writableNumberLocalStorageSubject()(
  'secondDimensionMaxValue',
  0
);
export const firstDimensionMargin$ = writableNumberLocalStorageSubject()('firstDimensionMargin', 0);

export const swipeThreshold$ = writableNumberLocalStorageSubject()('swipeThreshold', 10);

export const disableWheelNavigation$ = writableBooleanLocalStorageSubject()(
  'disableWheelNavigation',
  false
);

export const autoPositionOnResize$ = writableBooleanLocalStorageSubject()(
  'autoPositionOnResize',
  true
);

export const avoidPageBreak$ = writableBooleanLocalStorageSubject()('avoidPageBreak', false);

export const pauseTrackerOnCustomPointChange$ = writableBooleanLocalStorageSubject()(
  'pauseTrackerOnCustomPointChange',
  true
);

export const customReadingPointEnabled$ = writableBooleanLocalStorageSubject()(
  'customReadingPointEnabled',
  false
);

export const selectionToBookmarkEnabled$ = writableBooleanLocalStorageSubject()(
  'selectionToBookmarkEnabled',
  false
);

export const enableTapEdgeToFlip$ = writableBooleanLocalStorageSubject()(
  'enableTapEdgeToFlip',
  false
);

export const confirmClose$ = writableBooleanLocalStorageSubject()('confirmClose', false);

export const manualBookmark$ = writableBooleanLocalStorageSubject()('manualBookmark', false);

export const autoBookmark$ = writableBooleanLocalStorageSubject()('autoBookmark', true);

export const autoBookmarkTime$ = writableNumberLocalStorageSubject()('autoBookmarkTime', 3);

export const pageColumns$ = writableNumberLocalStorageSubject()('pageColumns', 0);

export const requestPersistentStorage$ = writableBooleanLocalStorageSubject()(
  'requestPersistentStorage',
  true
);

export const cacheStorageData$ = writableBooleanLocalStorageSubject()('cacheStorageData', false);

export const autoReplication$ = writableStringLocalStorageSubject<AutoReplicationType>()(
  'autoReplication',
  AutoReplicationType.Off
);

export const replicationSaveBehavior$ =
  writableStringLocalStorageSubject<ReplicationSaveBehavior>()(
    'replicationSaveBehavior',
    ReplicationSaveBehavior.NewOnly
  );

export const showExternalPlaceholder$ = writableBooleanLocalStorageSubject()(
  'showExternalPlaceholder',
  false
);

export const gDriveStorageSource$ = writableStringLocalStorageSubject()(
  'gDriveStorageSource',
  StorageSourceDefault.GDRIVE_DEFAULT
);

export const oneDriveStorageSource$ = writableStringLocalStorageSubject()(
  'oneDriveStorageSource',
  StorageSourceDefault.ONEDRIVE_DEFAULT
);

export const fsStorageSource$ = writableStringLocalStorageSubject()('fsStorageSource', '');

export const syncTarget$ = writableStringLocalStorageSubject()('syncTarget', '');

export const keepLocalStatisticsOnDeletion$ = writableBooleanLocalStorageSubject()(
  'keepLocalStatisticsOnDeletion',
  true
);

export const overwriteBookCompletion$ = writableBooleanLocalStorageSubject()(
  'overwriteBookCompletion',
  false
);

export const startDayHoursForTracker$ = writableNumberLocalStorageSubject()(
  'startDayHoursForTracker',
  0
);

export const statisticsEnabled$ = writableBooleanLocalStorageSubject()('statisticsEnabled', false);

export const statisticsMergeMode$ = writableStringLocalStorageSubject<MergeMode>()(
  'statisticsMergeMode',
  MergeMode.MERGE
);

export const readingGoalsMergeMode$ = writableStringLocalStorageSubject<MergeMode>()(
  'readingGoalsMergeMode',
  MergeMode.MERGE
);

export const trackerAutoPause$ = writableStringLocalStorageSubject<TrackerAutoPause>()(
  'trackerAutoPause',
  TrackerAutoPause.MODERATE
);

export const openTrackerOnCompletion$ = writableBooleanLocalStorageSubject()(
  'openTrackerOnCompletion',
  true
);

export const addCharactersOnCompletion$ = writableBooleanLocalStorageSubject()(
  'addCharactersOnCompletion',
  false
);

export const trackerAutostartTime$ = writableNumberLocalStorageSubject()('trackerAutoStartTime', 0);

export const trackerIdleTime$ = writableNumberLocalStorageSubject()('trackerIdleTime', 0);

export const trackerForwardSkipThreshold$ = writableNumberLocalStorageSubject()(
  'trackerForwardSkipThreshold',
  2700
);

export const trackerBackwardSkipThreshold$ = writableNumberLocalStorageSubject()(
  'trackerBackwardSkipThreshold',
  2700
);

export const trackerSkipThresholdAction$ =
  writableStringLocalStorageSubject<TrackerSkipThresholdAction>()(
    'trackerSkipThresholdAction',
    TrackerSkipThresholdAction.IGNORE
  );

export const trackerPopupDetection$ = writableBooleanLocalStorageSubject()(
  'trackerPopupDetection',
  false
);

export const adjustStatisticsAfterIdleTime$ = writableBooleanLocalStorageSubject()(
  'adjustStatisticsAfterIdleTime',
  true
);

export const readingGoal$ = writableObjectLocalStorageSubject<ReadingGoal>()('readingGoal', {
  timeGoal: 0,
  characterGoal: 0,
  goalFrequency: ReadingGoalFrequency.DAILY,
  goalStartDate: '',
  lastGoalModified: Date.now()
});

export const lastExportedTarget$ = writableStringLocalStorageSubject<StorageKey>()(
  'lastExportedTarget',
  StorageKey.BACKUP
);

export const lastExportedTypes$ = writableArrayLocalStorageSubject<StorageDataType>()(
  'lastExportedTypes',
  [StorageDataType.PROGRESS, StorageDataType.STATISTICS]
);

export const lastBlurredTrackerItems$ = writableSetLocalStorageSubject<string>()(
  'lastBlurredTrackerItems',
  new Set<string>()
);

export const lastSyncedSettingsSource$ = writableStringLocalStorageSubject()(
  'lastSyncedSettingsSource',
  InternalStorageSources.INTERNAL_BROWSER
);

export const lastSyncedSettingsTarget$ = writableStringLocalStorageSubject()(
  'lastSyncedSettingsTarget',
  InternalStorageSources.INTERNAL_ZIP
);

export const lastReadingGoalsModified$ = writableNumberLocalStorageSubject()(
  'lastReadingGoalsModified',
  0
);

export const lastStatisticsTab$ = writableStringLocalStorageSubject<StatisticsTab>()(
  'lastStatisticsTab',
  StatisticsTab.OVERVIEW
);

export const lastStatisticsRangeTemplate$ =
  writableStringLocalStorageSubject<StatisticsRangeTemplate>()(
    'lastStatisticsRangeTemplate',
    StatisticsRangeTemplate.TODAY
  );

export const lastStatisticsStartDate$ = writableStringLocalStorageSubject()(
  'lastStatisticsStartDate',
  ''
);

export const lastStatisticsEndDate$ = writableStringLocalStorageSubject()(
  'lastStatisticsEndDate',
  ''
);

export const lastStartDayOfWeek$ = writableNumberLocalStorageSubject()('lastStartDayOfWeek', 1);

export const lastReadingTimeDataSource$ = writableStringLocalStorageSubject<keyof BookStatistic>()(
  'lastReadingTimeDataSource',
  'readingTime'
);

export const lastCharactersDataSource$ = writableStringLocalStorageSubject<keyof BookStatistic>()(
  'lastCharactersDataSource',
  'charactersRead'
);

export const lastReadingSpeedDataSource$ = writableStringLocalStorageSubject<keyof BookStatistic>()(
  'lastReadingSpeedDataSource',
  'lastReadingSpeed'
);

export const lastPrimaryReadingDataAggregationMode$ =
  writableStringLocalStorageSubject<StatisticsReadingDataAggregationMode>()(
    'lastPrimaryReadingDataAggregationMode',
    StatisticsReadingDataAggregationMode.NONE
  );

export const confirmStatisticsDeletion$ = writableBooleanLocalStorageSubject()(
  'confirmStatisticsDeletion',
  true
);

export const lastStatisticsFilterDateRangeOnly$ = writableBooleanLocalStorageSubject()(
  'lastStatisticsFilterDateRangeOnly',
  false
);

export const lastStatisticsFilterShowSelectedTitlesOnly$ = writableBooleanLocalStorageSubject()(
  'lastStatisticsFilterShowSelectedTitlesOnly',
  false
);

export const lastReadingDataHeatmapAggregationMode$ =
  writableStringLocalStorageSubject<HeatmapDataAggregration>()(
    'lastReadingDataHeatmapAggregationMode',
    HeatmapDataAggregration.ALL_TIME
  );

export const lastReadingGoalsHeatmapAggregationMode$ =
  writableStringLocalStorageSubject<HeatmapDataAggregration>()(
    'lastReadingGoalsHeatmapAggregationMode',
    HeatmapDataAggregration.ALL_TIME
  );

export const lastStatisticsSummarySortProperty$ = writableStringLocalStorageSubject<
  keyof BookStatistic
>()('lastStatisticsSummarySortProperty', 'readingTime');

export const lastStatisticsSummarySortDirection$ =
  writableStringLocalStorageSubject<SortDirection>()(
    'lastStatisticsSummarySortDirection',
    SortDirection.DESC
  );

export const fileCountData$ = writableSubject<Record<string, number> | undefined>(undefined);

export const bookReaderKeybindMap$ = writableSubject<BookReaderKeybindMap>({
  KeyB: BookReaderAvailableKeybind.BOOKMARK,
  b: BookReaderAvailableKeybind.BOOKMARK,
  KeyR: BookReaderAvailableKeybind.JUMP_TO_BOOKMARK,
  r: BookReaderAvailableKeybind.JUMP_TO_BOOKMARK,
  PageDown: BookReaderAvailableKeybind.NEXT_PAGE,
  pagedown: BookReaderAvailableKeybind.NEXT_PAGE,
  PageUp: BookReaderAvailableKeybind.PREV_PAGE,
  pageup: BookReaderAvailableKeybind.PREV_PAGE,
  Space: BookReaderAvailableKeybind.AUTO_SCROLL_TOGGLE,
  ' ': BookReaderAvailableKeybind.AUTO_SCROLL_TOGGLE,
  KeyA: BookReaderAvailableKeybind.AUTO_SCROLL_INCREASE,
  a: BookReaderAvailableKeybind.AUTO_SCROLL_INCREASE,
  KeyD: BookReaderAvailableKeybind.AUTO_SCROLL_DECREASE,
  d: BookReaderAvailableKeybind.AUTO_SCROLL_DECREASE,
  KeyN: BookReaderAvailableKeybind.PREV_CHAPTER,
  n: BookReaderAvailableKeybind.PREV_CHAPTER,
  KeyM: BookReaderAvailableKeybind.NEXT_CHAPTER,
  m: BookReaderAvailableKeybind.NEXT_CHAPTER,
  KeyT: BookReaderAvailableKeybind.SET_READING_POINT,
  t: BookReaderAvailableKeybind.SET_READING_POINT,
  KeyP: BookReaderAvailableKeybind.TOGGLE_TRACKING,
  p: BookReaderAvailableKeybind.TOGGLE_TRACKING,
  KeyF: BookReaderAvailableKeybind.TOGGLE_TRACKING_FREEZE,
  f: BookReaderAvailableKeybind.TOGGLE_TRACKING_FREEZE
});

export const statisticsTabKeybindMap$ = writableSubject<StatisticsTabKeybindMap>({
  KeyT: StatisticsTabAvailableKeybind.RANGE_TEMPLATE_TOGGLE,
  t: StatisticsTabAvailableKeybind.RANGE_TEMPLATE_TOGGLE,
  KeyA: StatisticsTabAvailableKeybind.AGGREGRATION_TOGGLE,
  a: StatisticsTabAvailableKeybind.AGGREGRATION_TOGGLE
});

export const readerImageGalleryKeybindMap$ = writableSubject<ReaderImageGalleryKeybindMap>({
  PageDown: ReaderImageGalleryAvailableKeybind.NEXT_IMAGE,
  pagedown: ReaderImageGalleryAvailableKeybind.NEXT_IMAGE,
  ArrowDown: ReaderImageGalleryAvailableKeybind.NEXT_IMAGE,
  arrowdown: ReaderImageGalleryAvailableKeybind.NEXT_IMAGE,
  ArrowRight: ReaderImageGalleryAvailableKeybind.NEXT_IMAGE,
  arrowright: ReaderImageGalleryAvailableKeybind.NEXT_IMAGE,
  ArrowUp: ReaderImageGalleryAvailableKeybind.PREVIOUS_IMAGE,
  arrowup: ReaderImageGalleryAvailableKeybind.PREVIOUS_IMAGE,
  ArrowLeft: ReaderImageGalleryAvailableKeybind.PREVIOUS_IMAGE,
  arrowleft: ReaderImageGalleryAvailableKeybind.PREVIOUS_IMAGE,
  PageUp: ReaderImageGalleryAvailableKeybind.PREVIOUS_IMAGE,
  pageup: ReaderImageGalleryAvailableKeybind.PREVIOUS_IMAGE,
  Escape: ReaderImageGalleryAvailableKeybind.CLOSE,
  escape: ReaderImageGalleryAvailableKeybind.CLOSE
});

const db = browser ? createBooksDb() : import('fake-indexeddb/auto').then(() => createBooksDb());

export const database = new DatabaseService(db);

export const domainHintSeen$ = writableBooleanLocalStorageSubject()('domainHintSeen', false);

export const booklistSortOptions$ = writableObjectLocalStorageSubject<Record<string, SortOption>>()(
  'booklistSortOptions',
  {
    [StorageKey.BROWSER]: { property: 'lastBookOpen', direction: SortDirection.DESC },
    [StorageKey.GDRIVE]: { property: 'title', direction: SortDirection.ASC },
    [StorageKey.ONEDRIVE]: { property: 'title', direction: SortDirection.ASC },
    [StorageKey.FS]: { property: 'title', direction: SortDirection.ASC }
  }
);

export const verticalCustomReadingPosition$ = writableNumberLocalStorageSubject()(
  'verticalCustomReadingPosition',
  100
);

export const horizontalCustomReadingPosition$ = writableNumberLocalStorageSubject()(
  'horizontalCustomReadingPosition',
  0
);

export const isOnline$ = writableSubject<boolean>(true);

export const skipKeyDownListener$ = writableSubject<boolean>(false);

export const userFonts$ = writableArrayLocalStorageSubject<UserFont>()('userfonts', []);
