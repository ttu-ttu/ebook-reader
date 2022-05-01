<script lang="ts">
  import { buttonClasses } from '$lib/css-classes';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { logger } from '$lib/data/logger';
  import {
    autoPositionOnResize$,
    firstDimensionMargin$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    furiganaStyle$,
    hideFurigana$,
    hideSpoilerImage$,
    multiplier$,
    requestPersistentStorage$,
    secondDimensionMaxValue$,
    theme$,
    viewMode$,
    writingMode$
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
          multiplier: multiplier$.getValue(),
          fontSize: fontSize$.getValue(),
          fontFamilyGroupOne: fontFamilyGroupOne$.getValue(),
          fontFamilyGroupTwo: fontFamilyGroupTwo$.getValue(),
          hideSpoilerImage: hideSpoilerImage$.getValue(),
          hideFurigana: hideFurigana$.getValue(),
          furiganaStyle: furiganaStyle$.getValue(),
          writingMode: writingMode$.getValue(),
          viewMode: viewMode$.getValue(),
          secondDimensionMaxValue: secondDimensionMaxValue$.getValue(),
          firstDimensionMargin: firstDimensionMargin$.getValue(),
          autoPositionOnResize: autoPositionOnResize$.getValue(),
          requestPersistentStorage: requestPersistentStorage$.getValue()
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
    <a class={buttonClasses} href={downloadableLog} download="log.json">
      Download Report
      <Ripple />
    </a>
  </svelte:fragment>
</DialogTemplate>
