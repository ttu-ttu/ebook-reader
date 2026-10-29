<script lang="ts">
  import { browser } from '$app/environment';
  import BookExportSelection from '$lib/components/book-export/book-export-selection.svelte';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import {
    getStorageIconData,
    isStorageSourceAvailable,
    storageSource$
  } from '$lib/data/storage/storage-view';
  import {
    fsStorageSource$,
    gDriveStorageSource$,
    lastExportedTarget$,
    lastExportedTypes$,
    oneDriveStorageSource$,
    ttsuRemoteStorageSource$
  } from '$lib/data/store';
  import { executeReplicate$ } from '$lib/functions/replication/replication-progress';
  import { createEventDispatcher } from 'svelte';

  let icons = [
    { ...getStorageIconData(StorageKey.BACKUP), source: StorageKey.BACKUP, label: 'Zip File' },
    { ...getStorageIconData(StorageKey.BROWSER), source: StorageKey.BROWSER, label: 'Browser DB' }
  ];

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  console.info("doing dispact", isStorageSourceAvailable(StorageKey.TTSU_REMOTE, $ttsuRemoteStorageSource$, window));

  $: if (browser) {
    icons = [
      ...icons,
      ...(isStorageSourceAvailable(StorageKey.GDRIVE, $gDriveStorageSource$, window)
        ? [{ ...getStorageIconData(StorageKey.GDRIVE), source: StorageKey.GDRIVE, label: 'GDrive' }]
        : []),
      ...(isStorageSourceAvailable(StorageKey.ONEDRIVE, $oneDriveStorageSource$, window)
        ? [
            {
              ...getStorageIconData(StorageKey.ONEDRIVE),
              source: StorageKey.ONEDRIVE,
              label: 'OneDrive'
            }
          ]
        : []),
      ...(isStorageSourceAvailable(StorageKey.FS, $fsStorageSource$, window)
        ? [{ ...getStorageIconData(StorageKey.FS), source: StorageKey.FS, label: 'Filesystem' }]
        : []),
      ...(isStorageSourceAvailable(StorageKey.TTSU_REMOTE, $ttsuRemoteStorageSource$, window)
        ? [{ ...getStorageIconData(StorageKey.TTSU_REMOTE), source: StorageKey.TTSU_REMOTE, label: 'Ttsu Remote' }]
        : []),
    ].filter((icon) => icon.source !== $storageSource$);
  }

  function replicateData() {
    executeReplicate$.next();

    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="content">
    <BookExportSelection
      {icons}
      bind:target={$lastExportedTarget$}
      bind:dataToReplicate={$lastExportedTypes$}
    />
  </svelte:fragment>
  <div class="flex grow justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => dispatch('close')}>
      Cancel
      <Ripple />
    </button>
    <button
      class={buttonClasses}
      class:cursor-not-allowed={!$lastExportedTypes$.length}
      disabled={!$lastExportedTypes$.length}
      on:click={replicateData}
    >
      Start
      <Ripple />
    </button>
  </div>
</DialogTemplate>
