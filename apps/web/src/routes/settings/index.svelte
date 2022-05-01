<script lang="ts">
  import { onMount } from 'svelte';
  import { tap } from 'rxjs';
  import { afterNavigate } from '$app/navigation';
  import SettingsContent from '$lib/components/settings/settings-content.svelte';
  import SettingsHeader from '$lib/components/settings/settings-header.svelte';
  import { pxScreen } from '$lib/css-classes';
  import {
    autoPositionOnResize$,
    firstDimensionMargin$,
    fontFamilyGroupOne$,
    fontFamilyGroupTwo$,
    fontSize$,
    furiganaStyle$,
    hideFurigana$,
    hideSpoilerImage$,
    secondDimensionMaxValue$,
    theme$,
    writingMode$,
    viewMode$
  } from '$lib/data/store';
  import { storage } from '$lib/data/window/navigator/storage';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { writableSubject } from '$lib/functions/svelte/store';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';

  const persistentStorage$ = writableSubject(false);
  let persistentStorageReactive = false;

  onMount(() => {
    storage.persisted().then(setPersistentStorage);
  });

  let prevPage = '/manage';
  afterNavigate((navigation) => {
    const { from } = navigation;
    if (!from) return;
    prevPage = `${from.pathname}${from.search}`;
  });

  const setPersistentStorage$ = persistentStorage$.pipe(
    tap((value) => {
      if (!persistentStorageReactive) return;
      if (!value) {
        setPersistentStorage(true);
        return;
      }

      storage.persist().then(setPersistentStorage);
    }),
    reduceToEmptyString()
  );

  function setPersistentStorage(value: boolean) {
    persistentStorageReactive = false;
    persistentStorage$.next(value);
    persistentStorageReactive = true;
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Settings')}</title>
</svelte:head>

<div class="elevation-4 fixed inset-x-0 top-0 z-10">
  <SettingsHeader leavePageLink={prevPage} />
</div>

<div class="{pxScreen} h-full pt-16 xl:pt-14">
  <div class="max-w-5xl">
    <SettingsContent
      bind:selectedTheme={$theme$}
      bind:fontSize={$fontSize$}
      bind:fontFamilyGroupOne={$fontFamilyGroupOne$}
      bind:fontFamilyGroupTwo={$fontFamilyGroupTwo$}
      bind:blurImage={$hideSpoilerImage$}
      bind:hideFurigana={$hideFurigana$}
      bind:furiganaStyle={$furiganaStyle$}
      bind:writingMode={$writingMode$}
      bind:viewMode={$viewMode$}
      bind:secondDimensionMaxValue={$secondDimensionMaxValue$}
      bind:firstDimensionMargin={$firstDimensionMargin$}
      bind:autoPositionOnResize={$autoPositionOnResize$}
      bind:persistentStorage={$persistentStorage$}
    />
  </div>
</div>
{$setPersistentStorage$ ?? ''}
