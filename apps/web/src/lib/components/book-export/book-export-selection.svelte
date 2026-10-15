<script lang="ts">
  import BookExportIcon from '$lib/components/book-export/book-export-icon.svelte';
  import { StorageDataType, StorageKey } from '$lib/data/storage/storage-types';
  import type { StorageIconElement } from '$lib/data/storage/storage-view';
  import { isOnline$ } from '$lib/data/store';
  import { isOnlineSourceAvailable } from '$lib/functions/utils';
  import { onMount } from 'svelte';

  export let icons: StorageIconElement[];
  export let target: StorageKey;
  export let dataToReplicate: StorageDataType[];

  $: if (!isOnlineSourceAvailable($isOnline$, target)) {
    target = icons.find((icon) => icon.source === StorageKey.BACKUP)
      ? StorageKey.BACKUP
      : StorageKey.BROWSER;
  }

  onMount(() => {
    if (!icons.find((icon) => icon.source === target)) {
      target = StorageKey.BACKUP;
    }
  });
</script>

<h2 class="mb-4 text-xl font-medium">Export Target</h2>
<div class="mb-4 grid grid-cols-2 gap-8">
  {#each icons as icon (icon.source)}
    {@const disabled = !isOnlineSourceAvailable($isOnline$, icon.source)}
    <BookExportIcon
      {...icon}
      {disabled}
      selected={icon.source === target}
      on:click={() => {
        if (!disabled) {
          target = icon.source;
        }
      }}
    />
  {/each}
</div>
<h2 class="mb-2 text-xl font-medium">Export Content</h2>
<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
  <div class="mr-4">
    <input type="checkbox" id="bookdata" name="data" value="data" bind:group={dataToReplicate} />
    <label for="bookdata">Book Data</label>
  </div>
  <div>
    <input
      type="checkbox"
      id="bookprogress"
      name="bookmark"
      value="bookmark"
      bind:group={dataToReplicate}
    />
    <label for="bookprogress">Bookmark</label>
  </div>
  <div>
    <input
      type="checkbox"
      id="bookstatistic"
      name="statistic"
      value="statistic"
      bind:group={dataToReplicate}
    />
    <label for="bookstatistic">Statistics</label>
  </div>
  <div>
    <input
      type="checkbox"
      id="audioBook"
      name="audioBook"
      value="audioBook"
      bind:group={dataToReplicate}
    />
    <label for="bookstatistic">Audiobook</label>
  </div>
  <div>
    <input
      type="checkbox"
      id="subtitle"
      name="subtitle"
      value="subtitle"
      bind:group={dataToReplicate}
    />
    <label for="bookstatistic">Subtitles</label>
  </div>
</div>
