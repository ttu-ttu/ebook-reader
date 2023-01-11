<script lang="ts">
  import BookExportIcon from '$lib/components/book-export/book-export-icon.svelte';
  import { StorageDataType, StorageKey } from '$lib/data/storage/storage-types';
  import type { StorageIconElement } from '$lib/data/storage/storage-view';
  import { isOnline$ } from '$lib/data/store';
  import { onMount } from 'svelte';

  export let icons: StorageIconElement[];
  export let target: StorageKey;
  export let dataToReplicate: StorageDataType[];

  $: if (!$isOnline$ && requiresConnection(target)) {
    target = icons.find((icon) => icon.source === StorageKey.BACKUP)
      ? StorageKey.BACKUP
      : StorageKey.BROWSER;
  }

  function requiresConnection(storageKey: StorageKey) {
    return storageKey === StorageKey.GDRIVE || storageKey === StorageKey.ONEDRIVE;
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
    {@const disabled = requiresConnection(icon.source) && !$isOnline$}
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
</div>
