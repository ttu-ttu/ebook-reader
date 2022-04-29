<script lang="ts">
  import { MetaTags } from 'svelte-meta-tags';
  import { page } from '$app/stores';
  import { basePath } from '$lib/data/env';
  import { dialogManager, type Dialog } from '$lib/data/dialog-manager';
  import '../app.scss';

  let path = '';
  page.subscribe((p) => (path = p.url.pathname));

  let dialogs: Dialog[] = [];
  dialogManager.dialogs$.subscribe((d) => (dialogs = d));

  function closeAllDialogs() {
    dialogManager.dialogs$.next([]);
  }
</script>

<MetaTags
  title="ッツ Ebook Reader"
  description="Online e-book reader that supports Yomichan"
  canonical="{basePath}{path !== '/' ? path : ''}"
  openGraph={{
    type: 'website',
    images: [
      {
        url: `${basePath}/icons/regular-icon@512x512.png`,
        width: 512,
        height: 512
      }
    ]
  }}
/>

<slot />

{#if dialogs.length > 0}
  <div class="writing-horizontal-tb fixed inset-0 z-50 h-full w-full">
    <div
      class="tap-highlight-transparent absolute inset-0 bg-black/[.32]"
      on:click={closeAllDialogs}
    />

    <div
      class="relative top-1/2 left-1/2 inline-block max-w-[80vw] -translate-x-1/2 -translate-y-1/2"
    >
      {#each dialogs as dialog}
        <svelte:component this={dialog.component} {...dialog.props} on:close={closeAllDialogs} />
      {/each}
    </div>
  </div>
{/if}
