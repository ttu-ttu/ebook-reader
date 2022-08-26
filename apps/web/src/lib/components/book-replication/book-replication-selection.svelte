<script lang="ts">
  import BookReplicationIcon from '$lib/components/book-replication/book-replication-icon.svelte';
  import type {
    StorageDataType,
    StorageKey,
    StorageIconElement
  } from '$lib/data/storage-manager/storage-source';

  export let dataToReplicate: StorageDataType[];
  export let icons: StorageIconElement[];
  export let target: StorageKey;
</script>

<div class="mb-8 flex grow justify-center">
  {#each icons as icon (icon.source)}
    <BookReplicationIcon
      {...icon}
      selected={icon.source === target}
      on:click={() => {
        target = icon.source;
      }}
    />
  {/each}
</div>
<div class="ml-5 flex">
  <div class="mb-4 mr-4">
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
