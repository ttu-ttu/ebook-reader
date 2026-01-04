<script lang="ts">
  import { onMount } from 'svelte';
  import { tap } from 'rxjs';
  import { afterNavigate } from '$app/navigation';
  import SettingsContent from '$lib/components/settings/settings-content.svelte';
  import SettingsHeader from '$lib/components/settings/settings-header.svelte';
  import { pxScreen } from '$lib/css-classes';
  import {
    addCharactersOnCompletion$,
    adjustStatisticsAfterIdleTime$,
    autoBookmark$,
    autoBookmarkTime$,
    autoPositionOnResize$,
    autoReplication$,
    avoidPageBreak$,
    cacheStorageData$,
    confirmClose$,
    customReadingPointEnabled$,
    disableWheelNavigation$,
    enableFontVPAL$,
    enableReaderWakeLock$,
    enableTapEdgeToFlip$,
    enableTextJustification$,
    enableTextWrapPretty$,
    enableVerticalFontKerning$,
    firstDimensionMargin$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    furiganaStyle$,
    hideFurigana$,
    hideSpoilerImage$,
    lineHeight$,
    manualBookmark$,
    keepLocalStatisticsOnDeletion$,
    openTrackerOnCompletion$,
    overwriteBookCompletion$,
    pageColumns$,
    pauseTrackerOnCustomPointChange$,
    prioritizeReaderStyles$,
    replicationSaveBehavior$,
    secondDimensionMaxValue$,
    selectionToBookmarkEnabled$,
    showCharacterCounter$,
    showPercentage$,
    showExternalPlaceholder$,
    startDayHoursForTracker$,
    statisticsEnabled$,
    statisticsMergeMode$,
    swipeThreshold$,
    textIndentation$,
    textMarginMode$,
    textMarginValue$,
    theme$,
    trackerAutoPause$,
    trackerBackwardSkipThreshold$,
    trackerForwardSkipThreshold$,
    trackerAutostartTime$,
    trackerIdleTime$,
    trackerPopupDetection$,
    trackerSkipThresholdAction$,
    verticalTextOrientation$,
    viewMode$,
    writingMode$,
    readingGoalsMergeMode$,
    hideSpoilerImageMode$
  } from '$lib/data/store';
  import { mergeEntries } from '$lib/components/merged-header-icon/merged-entries';
  import { pagePath } from '$lib/data/env';
  import { storage } from '$lib/data/window/navigator/storage';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { writableSubject } from '$lib/functions/svelte/store';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';

  const persistentStorage$ = writableSubject(false);
  let persistentStorageReactive = false;

  onMount(() => {
    storage.persisted().then(setPersistentStorage);

    setStorageQuota();
  });

  let prevPage = `${pagePath}${mergeEntries.MANAGE.routeId}`;

  let activeSettings = 'Reader';

  let storageQuota = '';

  afterNavigate((navigation) => {
    const { from } = navigation;
    if (!from) return;
    prevPage = `${from.url.pathname}${from.url.search}`;
  });

  const setPersistentStorage$ = persistentStorage$.pipe(
    tap((value) => {
      if (!persistentStorageReactive) return;
      if (!value) {
        setPersistentStorage(true);
        return;
      }

      storage.persist().then(setPersistentStorage).finally(setStorageQuota);
    }),
    reduceToEmptyString()
  );

  function setPersistentStorage(value: boolean) {
    persistentStorageReactive = false;
    persistentStorage$.next(value);
    persistentStorageReactive = true;
  }

  function setStorageQuota() {
    storage
      .estimate()
      .then((storageData) => {
        const { usage, quota } = storageData;

        if (usage === undefined || quota === undefined) {
          return;
        }

        storageQuota = `${Math.round(((usage / quota) * 100 + Number.EPSILON) * 100) / 100} % used`;
      })
      .catch(() => {
        // no-op
      });
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Settings')}</title>
</svelte:head>

<div class="elevation-4 fixed inset-x-0 top-0 z-10">
  <SettingsHeader leavePageLink={prevPage} bind:activeSettings />
</div>

<div class="{pxScreen} h-full pt-16 xl:pt-14">
  <div class="max-w-5xl">
    <SettingsContent
      {activeSettings}
      {storageQuota}
      bind:selectedTheme={$theme$}
      bind:fontFamilyGroupOne={$fontFamilyGroupOne$}
      bind:fontFamilyGroupTwo={$fontFamilyGroupTwo$}
      bind:fontSize={$fontSize$}
      bind:lineHeight={$lineHeight$}
      bind:textIndentation={$textIndentation$}
      bind:textMarginValue={$textMarginValue$}
      bind:blurImage={$hideSpoilerImage$}
      bind:blurImageMode={$hideSpoilerImageMode$}
      bind:hideFurigana={$hideFurigana$}
      bind:furiganaStyle={$furiganaStyle$}
      bind:writingMode={$writingMode$}
      bind:enableFontKerning={$enableVerticalFontKerning$}
      bind:enableFontVPAL={$enableFontVPAL$}
      bind:verticalTextOrientation={$verticalTextOrientation$}
      bind:prioritizeReaderStyles={$prioritizeReaderStyles$}
      bind:enableTextJustification={$enableTextJustification$}
      bind:enableTextWrapPretty={$enableTextWrapPretty$}
      bind:textMarginMode={$textMarginMode$}
      bind:enableReaderWakeLock={$enableReaderWakeLock$}
      bind:showCharacterCounter={$showCharacterCounter$}
      bind:showPercentage={$showPercentage$}
      bind:viewMode={$viewMode$}
      bind:secondDimensionMaxValue={$secondDimensionMaxValue$}
      bind:firstDimensionMargin={$firstDimensionMargin$}
      bind:swipeThreshold={$swipeThreshold$}
      bind:disableWheelNavigation={$disableWheelNavigation$}
      bind:autoPositionOnResize={$autoPositionOnResize$}
      bind:avoidPageBreak={$avoidPageBreak$}
      bind:pauseTrackerOnCustomPointChange={$pauseTrackerOnCustomPointChange$}
      bind:customReadingPointEnabled={$customReadingPointEnabled$}
      bind:selectionToBookmarkEnabled={$selectionToBookmarkEnabled$}
      bind:enableTapEdgeToFlip={$enableTapEdgeToFlip$}
      bind:pageColumns={$pageColumns$}
      bind:persistentStorage={$persistentStorage$}
      bind:confirmClose={$confirmClose$}
      bind:manualBookmark={$manualBookmark$}
      bind:autoBookmark={$autoBookmark$}
      bind:autoBookmarkTime={$autoBookmarkTime$}
      bind:cacheStorageData={$cacheStorageData$}
      bind:replicationSaveBehavior={$replicationSaveBehavior$}
      bind:autoReplication={$autoReplication$}
      bind:showExternalPlaceholder={$showExternalPlaceholder$}
      bind:keepLocalStatisticsOnDeletion={$keepLocalStatisticsOnDeletion$}
      bind:overwriteBookCompletion={$overwriteBookCompletion$}
      bind:startDayHoursForTracker={$startDayHoursForTracker$}
      bind:statisticsMergeMode={$statisticsMergeMode$}
      bind:readingGoalsMergeMode={$readingGoalsMergeMode$}
      bind:statisticsEnabled={$statisticsEnabled$}
      bind:trackerAutoPause={$trackerAutoPause$}
      bind:openTrackerOnCompletion={$openTrackerOnCompletion$}
      bind:addCharactersOnCompletion={$addCharactersOnCompletion$}
      bind:trackerAutoStartTime={$trackerAutostartTime$}
      bind:trackerIdleTime={$trackerIdleTime$}
      bind:trackerForwardSkipThreshold={$trackerForwardSkipThreshold$}
      bind:trackerBackwardSkipThreshold={$trackerBackwardSkipThreshold$}
      bind:trackerSkipThresholdAction={$trackerSkipThresholdAction$}
      bind:trackerPopupDetection={$trackerPopupDetection$}
      bind:adjustStatisticsAfterIdleTime={$adjustStatisticsAfterIdleTime$}
    />
  </div>
</div>
{$setPersistentStorage$ ?? ''}
