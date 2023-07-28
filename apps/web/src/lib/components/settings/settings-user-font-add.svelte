<script lang="ts">
  import { inputClasses } from '$lib/css-classes';
  import { reservedFontNames } from '$lib/data/fonts';
  import { userFonts$ } from '$lib/data/store';
  import { dummyFn } from '$lib/functions/utils';
  import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';

  export let isLoading: boolean;
  export let fontCache: Cache;

  let fileElement: HTMLInputElement;
  let fontName = '';
  let fontFile: File | undefined;
  let currentError = 'no error';

  $: canSave = !!fontName && !!fontFile && currentError === 'no error';

  function handleFileChange(event: Event) {
    const elm = event.target as HTMLInputElement;
    const file = elm.files?.[0];

    currentError = 'no error';

    if (!file) {
      resetFileElement();
      return;
    }

    if (
      !(
        file.name.endsWith('.woff2') ||
        file.name.endsWith('.woff') ||
        file.name.endsWith('.ttf') ||
        file.name.endsWith('.otf')
      )
    ) {
      currentError = 'only woff2, woff, ttf and otf fonts are supported';
      resetFileElement();
      return;
    }

    if (
      reservedFontNames.has(fontName) ||
      $userFonts$.find((userFont) => userFont.fileName === file.name || userFont.name === fontName)
    ) {
      currentError = 'a font file with this name is already stored';
      resetFileElement();
      return;
    }

    fontFile = file;
  }

  function resetFileElement() {
    fileElement.value = '';
    fontFile = undefined;
  }

  async function addFont() {
    if (!fontFile) {
      return;
    }

    isLoading = true;

    try {
      const path = `/userfonts/${fontFile.name}`;
      await fontCache.put(
        path,
        new Response(fontFile, {
          headers: {
            'Content-Type': `font/${fontFile.name.split('.').pop()}`,
            'Content-Length': `${fontFile.size}`
          }
        })
      );

      $userFonts$ = [...$userFonts$, { name: fontName, path, fileName: fontFile.name }];
      fontName = '';
      resetFileElement();
    } catch (error: any) {
      currentError = error.message;
    }

    isLoading = false;
  }
</script>

<div class="flex flex-col min-w-[15rem] md:min-w-[20rem]">
  <span>Font Name</span>
  <input
    class="mt-2"
    type="text"
    bind:value={fontName}
    on:blur={() => {
      currentError = 'no error';

      if (
        reservedFontNames.has(fontName) ||
        $userFonts$.find((userFont) => userFont.name === fontName)
      ) {
        currentError = 'a font file with this name is already stored';
      }
    }}
  />
  <div class:invisible={currentError === 'no error'} class="my-2 text-red-500">{currentError}</div>
  <div class="flex items-center just justify-between">
    <label class={`${inputClasses} w-40 text-center py-2 hover:opacity-25 mr-2`}>
      <input
        type="file"
        accept=".woff2,.woff,.ttf,.otf,application/font-woff2,application/font-woff,application/font-ttf,application/font-otf"
        class="hidden"
        bind:this={fileElement}
        on:change={handleFileChange}
      />
      Choose File
    </label>
    <div
      role="button"
      tabindex="0"
      class:cursor-pointer={canSave}
      class:text-gray-500={!canSave}
      class:cursor-not-allowed={!canSave}
      on:click={() => {
        if (canSave) {
          addFont();
        }
      }}
      on:keyup={dummyFn}
    >
      <Fa class="text-xl mx-2" icon={faFloppyDisk} />
    </div>
  </div>
</div>
