<script lang="ts">
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import SvelteUserFontAdd from '$lib/components/settings/settings-user-font-add.svelte';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { userFontsCacheName } from '$lib/data/fonts';
  import { logger } from '$lib/data/logger';
  import { userFonts$ } from '$lib/data/store';
  import { dummyFn } from '$lib/functions/utils';
  import { faSpinner, faTrashCan } from '@fortawesome/free-solid-svg-icons';
  import type { BehaviorSubject } from 'rxjs';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';

  export let fontFamily: BehaviorSubject<string>;

  const tabs = ['Stored', 'Add'];

  let isLoading = false;
  let cacheLoaded = false;
  let currentTab = 'Stored';
  let fontCache: Cache | undefined;

  onMount(async () => {
    try {
      fontCache = await caches.open(userFontsCacheName);

      const fonts = (await fontCache.keys()).map(
        (request: Request) => new URL(request.url).pathname
      );

      $userFonts$ = $userFonts$.filter((userFont) => fonts.includes(userFont.path));

      for (let index = 0, { length } = fonts; index < length; index += 1) {
        const font = fonts[index];
        const cachedFont = $userFonts$.find((userFont) => userFont.path === font);

        if (!cachedFont) {
          fontCache.delete(font).catch(() => {
            // no-op
          });
        }
      }
    } catch (error: any) {
      logger.error(`Error loading font cache: ${error.message}`);
      fontCache = undefined;
    }

    cacheLoaded = true;
  });

  function selectFont(fontName: string) {
    fontFamily.next(fontName);
    dialogManager.dialogs$.next([]);
  }

  async function removeFont(path: string) {
    if (!fontCache) {
      return;
    }

    isLoading = true;

    try {
      await fontCache.delete(path);

      $userFonts$ = $userFonts$.filter((userFont) => userFont.path !== path);

      const currentFontName = fontFamily.getValue();

      if (!$userFonts$.find((userFont) => userFont.name === currentFontName)) {
        fontFamily.next('');
      }
    } catch (error: any) {
      logger.error(`Error deleting Font: ${error.message}`);
    }

    isLoading = false;
  }
</script>

<DialogTemplate>
  <div slot="content">
    {#if cacheLoaded}
      <div class="border-b border-b-gray-200">
        <ul class="-mb-px flex items-center gap-4 text-sm font-medium">
          {#each tabs as tab (tab)}
            <li class="flex-1">
              <button
                class="relative flex items-center justify-center gap-2 px-1 py-3 hover:text-blue-700"
                class:text-blue-700={currentTab === tab}
                class:after:absolute={currentTab === tab}
                class:after:left-0={currentTab === tab}
                class:after:bottom-0={currentTab === tab}
                class:after:h-0.5={currentTab === tab}
                class:after:w-full={currentTab === tab}
                class:after:bg-blue-700={currentTab === tab}
                class:text-gray-500={currentTab !== tab}
                on:click={() => (currentTab = tab)}
              >
                {tab}
              </button>
            </li>
          {/each}
        </ul>
      </div>
      <div class="mt-5">
        {#if currentTab === 'Stored'}
          {#if $userFonts$.length}
            <div
              class="grid grid-cols-[max-content,max-content,auto] gap-y-4 gap-x-14 items-center"
            >
              {#each $userFonts$ as userFont (userFont.path)}
                <div
                  role="button"
                  class="hover:text-blue-700"
                  on:click={() => selectFont(userFont.name)}
                  on:keyup={dummyFn}
                >
                  {userFont.name}
                </div>
                <div
                  role="button"
                  class="hover:text-blue-700"
                  on:click={() => selectFont(userFont.name)}
                  on:keyup={dummyFn}
                >
                  {userFont.fileName}
                </div>
                <div
                  role="button"
                  class="hover:text-blue-700"
                  on:click={() => removeFont(userFont.path)}
                  on:keyup={dummyFn}
                >
                  <Fa icon={faTrashCan} />
                </div>
              {/each}
            </div>
          {:else}
            <div>You have currently no stored Fonts</div>
          {/if}
        {:else if fontCache}
          <SvelteUserFontAdd {fontCache} bind:isLoading />
        {/if}
      </div>
    {/if}
    {#if !cacheLoaded || isLoading}
      <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
        <Fa icon={faSpinner} spin />
      </div>
    {/if}
  </div>
</DialogTemplate>
