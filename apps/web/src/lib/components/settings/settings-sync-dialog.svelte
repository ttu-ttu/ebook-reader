<script lang="ts">
  import { faArrowsUpDown } from '@fortawesome/free-solid-svg-icons';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { baseIconClasses, buttonClasses } from '$lib/css-classes';
  import { InternalStorageSources, StorageKey } from '$lib/data/storage/storage-types';
  import type { BooksDbStorageSource } from '$lib/data/database/books-db/versions/books-db';
  import type { SyncSelection } from '$lib/data/dialog-manager';
  import { lastSyncedSettingsSource$, lastSyncedSettingsTarget$ } from '$lib/data/store';
  import { dummyFn } from '$lib/functions/utils';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let settingsSyncHeader = '';
  export let storageSources: BooksDbStorageSource[] = [];
  export let resolver: (arg0: SyncSelection[]) => void;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  const syncSources: SyncSelection[] = [
    { id: InternalStorageSources.INTERNAL_BROWSER, label: 'Browser DB', type: StorageKey.BROWSER },
    { id: InternalStorageSources.INTERNAL_ZIP, label: 'ZIP File', type: StorageKey.BACKUP },
    ...storageSources.map((storageSource) => ({
      id: storageSource.name,
      label: `${storageSource.name} (${storageSource.type})`,
      type: storageSource.type
    }))
  ];

  let selectedSource =
    syncSources.find((entry) => entry.id === $lastSyncedSettingsSource$)?.id || syncSources[0].id;
  let selectedTarget =
    syncSources.find((entry) => entry.id === $lastSyncedSettingsTarget$)?.id || syncSources[1].id;

  $: sources = syncSources.filter(
    (entry) => entry.id !== selectedTarget && entry.id !== InternalStorageSources.INTERNAL_ZIP
  );
  $: targets = syncSources.filter((entry) => entry.id !== selectedSource);

  function closeDialog(wasCanceled = false) {
    if (!wasCanceled) {
      $lastSyncedSettingsSource$ = selectedSource;
      $lastSyncedSettingsTarget$ = selectedTarget;
    }

    resolver(
      wasCanceled
        ? []
        : [
            syncSources.find((entry) => entry.id === selectedSource)!,
            syncSources.find((entry) => entry.id === selectedTarget)!
          ]
    );
    dispatch('close');
  }
</script>

<DialogTemplate>
  <svelte:fragment slot="header">{settingsSyncHeader}</svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex flex-col">
      <div>Source</div>
      <select bind:value={selectedSource}>
        {#each sources as source (source.id)}
          <option value={source.id}>
            {source.label}
          </option>
        {/each}
      </select>
      <div
        tabindex="0"
        role="button"
        class="transform-gpu {baseIconClasses} flex justify-center"
        style="width: 100%;"
        style:cursor={selectedTarget === InternalStorageSources.INTERNAL_ZIP
          ? 'not-allowed'
          : 'pointer'}
        on:click={() => {
          if (selectedTarget === InternalStorageSources.INTERNAL_ZIP) {
            return;
          }

          const oldSource = selectedSource;
          const oldTarget = selectedTarget;

          selectedSource = oldTarget;
          selectedTarget = oldSource;
        }}
        on:keyup={dummyFn}
      >
        <Fa icon={faArrowsUpDown} />
      </div>
      <div>Target</div>
      <select bind:value={selectedTarget}>
        {#each targets as target (target.id)}
          <option value={target.id}>
            {target.label}
          </option>
        {/each}
      </select>
    </div>
  </svelte:fragment>
  <div class="flex grow justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => closeDialog(true)}>
      Cancel
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={() => closeDialog()}>
      Confirm
      <Ripple />
    </button>
  </div>
</DialogTemplate>
