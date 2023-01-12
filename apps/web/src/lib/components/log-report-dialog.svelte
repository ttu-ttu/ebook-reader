<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { logger } from '$lib/data/logger';
  import { StorageSourceDefault } from '$lib/data/storage/storage-types';
  import {
    theme$,
    viewMode$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    lineHeight$,
    firstDimensionMargin$,
    secondDimensionMaxValue$,
    swipeThreshold$,
    disableWheelNavigation$,
    writingMode$,
    confirmClose$,
    autoBookmark$,
    hideSpoilerImage$,
    hideFurigana$,
    furiganaStyle$,
    avoidPageBreak$,
    customReadingPointEnabled$,
    selectionToBookmarkEnabled$,
    pageColumns$,
    autoPositionOnResize$,
    requestPersistentStorage$,
    cacheStorageData$,
    autoReplication$,
    replicationSaveBehavior$,
    showExternalPlaceholder$,
    gDriveStorageSource$,
    oneDriveStorageSource$,
    fsStorageSource$,
    syncTarget$,
    isOnline$,
    multiplier$
  } from '$lib/data/store';

  export let title = 'Error';

  export let message: string;

  const encodedLog = encodeURIComponent(
    JSON.stringify(
      {
        userAgent: navigator.userAgent,
        viewport: {
          visualViewport: !!window.visualViewport,
          width: window.visualViewport?.width ?? window.innerWidth,
          height: window.visualViewport?.height ?? window.innerHeight
        },
        settings: {
          theme: theme$.getValue(),
          viewMode: viewMode$.getValue(),
          fontFamilyGroupOne: fontFamilyGroupOne$.getValue(),
          fontFamilyGroupTwo: fontFamilyGroupTwo$.getValue(),
          fontSize: fontSize$.getValue(),
          lineHeight: lineHeight$.getValue(),
          firstDimensionMargin: firstDimensionMargin$.getValue(),
          secondDimensionMaxValue: secondDimensionMaxValue$.getValue(),
          swipeThreshold: swipeThreshold$.getValue(),
          disableWheelNavigation: disableWheelNavigation$.getValue(),
          writingMode: writingMode$.getValue(),
          confirmClose: confirmClose$.getValue(),
          autoBookmark: autoBookmark$.getValue(),
          hideSpoilerImage: hideSpoilerImage$.getValue(),
          hideFurigana: hideFurigana$.getValue(),
          furiganaStyle: furiganaStyle$.getValue(),
          avoidPageBreak: avoidPageBreak$.getValue(),
          customReadingPointEnabled: customReadingPointEnabled$.getValue(),
          selectionToBookmarkEnabled: selectionToBookmarkEnabled$.getValue(),
          pageColumns: pageColumns$.getValue(),
          autoPositionOnResize: autoPositionOnResize$.getValue(),
          requestPersistentStorage: requestPersistentStorage$.getValue(),
          cacheStorageData: cacheStorageData$.getValue(),
          autoReplication: autoReplication$.getValue(),
          replicationSaveBehavior: replicationSaveBehavior$.getValue(),
          showExternalPlaceholder: showExternalPlaceholder$.getValue(),
          gDriveStorageSource:
            gDriveStorageSource$.getValue() === StorageSourceDefault.GDRIVE_DEFAULT,
          oneDriveStorageSource:
            oneDriveStorageSource$.getValue() === StorageSourceDefault.ONEDRIVE_DEFAULT,
          fsStorageSource: !!fsStorageSource$.getValue(),
          syncTarget: !!syncTarget$.getValue(),
          isOnline: isOnline$.getValue(),
          multiplier: multiplier$.getValue()
        },
        log: logger.history
      },
      null,
      2
    )
  );
  const downloadableLog = `data:text/json;charset=utf-8,${encodedLog}`;
</script>

<DialogTemplate>
  <svelte:fragment slot="header">{title}</svelte:fragment>
  <svelte:fragment slot="content">
    <p>{message}</p>
  </svelte:fragment>
  <svelte:fragment slot="footer">
    <a
      class={buttonClasses}
      href="https://github.com/ttu-ttu/ebook-reader"
      target="_blank"
      rel="noreferrer"
    >
      Open Repository
      <Ripple />
    </a>
    <a class={buttonClasses} href={downloadableLog} download="log.json">
      Download Report
      <Ripple />
    </a>
  </svelte:fragment>
</DialogTemplate>
