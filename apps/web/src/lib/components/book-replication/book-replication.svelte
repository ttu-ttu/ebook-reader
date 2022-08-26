<script lang="ts">
  import BookReplicationSelection from '$lib/components/book-replication/book-replication-selection.svelte';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import {
    getStorageIconData,
    StorageDataType,
    StorageKey
  } from '$lib/data/storage-manager/storage-source';
  import { replicationStart$ } from '$lib/functions/replication/replication-progress';
  import { createEventDispatcher } from 'svelte';

  export let dataToReplicate: StorageDataType[];
  export let source: StorageKey;
  export let target: StorageKey;

  const icons = [
    { ...getStorageIconData(StorageKey.BACKUP), source: StorageKey.BACKUP, label: 'Zip Export' },
    { ...getStorageIconData(StorageKey.BROWSER), source: StorageKey.BROWSER, label: 'Browser DB' }
  ].filter((icon) => icon.source !== source);

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function replicateData() {
    replicationStart$.next({ source, target, dataToReplicate });

    dispatch('close');
  }
</script>

<DialogTemplate>
  <div class="flex flex-col" slot="content">
    <BookReplicationSelection {icons} bind:target bind:dataToReplicate />
  </div>
  <div class="flex grow flex-col" slot="footer">
    <div class="flex grow justify-between">
      <div class="flex">
        <button class={buttonClasses} on:click={() => dispatch('close')}>
          Cancel
          <Ripple />
        </button>
      </div>
      <button class={buttonClasses} disabled={!dataToReplicate.length} on:click={replicateData}>
        Start
        <Ripple />
      </button>
    </div>
  </div>
</DialogTemplate>
