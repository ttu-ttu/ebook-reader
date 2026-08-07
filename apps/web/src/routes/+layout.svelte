<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import DomainHint from '$lib/components/domain-hint.svelte';
  import { basePath, clearConsoleOnReload } from '$lib/data/env';
  import { dialogManager, type Dialog } from '$lib/data/dialog-manager';
  import { userFontsCacheName, type UserFont } from '$lib/data/fonts';
  import { fontFamilyGroupOne$, isOnline$, userFonts$ } from '$lib/data/store';
  import { dummyFn, isMobile, isMobile$ } from '$lib/functions/utils';
  import { MetaTags } from 'svelte-meta-tags';
  import { theme$, customThemes$ } from '$lib/data/store';
  import { availableThemes } from '$lib/data/theme-option';
  import '../app.scss';

  let path = '';
  let dialogs: Dialog[] = [];
  let clickOnCloseDisabled = false;
  let zIndex = '';

  $: if (browser) {
    isMobile$.next(isMobile(window));
    addUserFonts($userFonts$);
  }

  if (clearConsoleOnReload && import.meta.hot) {
    // eslint-disable-next-line no-console
    import.meta.hot.on('vite:beforeUpdate', () => console.clear());
  }

  function addUserFonts(userFonts: UserFont[]) {
    let styleContent = '';

    for (let index = 0, { length } = userFonts; index < length; index += 1) {
      const userFont = userFonts[index];
      const ext = userFont.fileName.split('.').pop() || '';

      let format = '';

      switch (ext) {
        case 'otf':
          format = 'opentype';
          break;
        case 'ttf':
          format = 'truetype';
          break;
        default:
          format = ext;
          break;
      }

      styleContent += `@font-face{font-family: '${userFont.name}';font-style: normal;font-weight: 400;font-display: swap;src: local(''), url('${userFont.path}') format('${format}')}\n`;
    }

    let styleElement = document.getElementById(userFontsCacheName);

    if (!styleContent) {
      styleElement?.remove();
      return;
    }

    const textNode = document.createTextNode(styleContent);

    if (styleElement) {
      styleElement.replaceChild(textNode, styleElement.childNodes[0]);
    } else {
      styleElement = document.createElement('style');
      styleElement.id = userFontsCacheName;

      styleElement.appendChild(textNode);
      document.head.append(styleElement);
    }
  }

  $: currentThemeData = availableThemes.get($theme$) || $customThemes$[$theme$];

  $: if (browser && currentThemeData) {
    const root = document.documentElement;
    // Apply the colors as CSS variables
    root.style.setProperty('--global-bg', currentThemeData.backgroundColor);
    root.style.setProperty('--global-text', currentThemeData.fontColor);
  }

  function closeAllDialogs() {
    dialogManager.dialogs$.next([]);
    clickOnCloseDisabled = false;
    zIndex = '';
  }

  dialogManager.dialogs$.subscribe((d) => {
    clickOnCloseDisabled = d[0]?.disableCloseOnClick ?? false;
    zIndex = d[0]?.zIndex ?? '';
    dialogs = d;
  });

  page.subscribe((p) => (path = p.url.pathname));
</script>

<svelte:window bind:online={$isOnline$} />

<MetaTags
  title="ッツ Ebook Reader"
  description="Online e-book reader that supports dictionary extensions like Yomitan"
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
  <div class="writing-horizontal-tb fixed inset-0 z-50 h-full w-full" style:z-index={zIndex}>
    <div
      tabindex="0"
      role="button"
      class="tap-highlight-transparent absolute inset-0 bg-black/[.32]"
      on:click={() => {
        if (!clickOnCloseDisabled) {
          closeAllDialogs();
        }
      }}
      on:keyup={dummyFn}
    />

    <div
      class="relative top-1/2 left-1/2 inline-block max-w-[80vw] -translate-x-1/2 -translate-y-1/2"
    >
      {#each dialogs as dialog}
        {#if typeof dialog.component === 'string'}
          {@html dialog.component}
        {:else}
          <svelte:component this={dialog.component} {...dialog.props} on:close={closeAllDialogs} />
        {/if}
      {/each}
    </div>
  </div>
{/if}

<span style={`font-family: ${$fontFamilyGroupOne$ || 'Noto Serif JP'}`} />

<DomainHint />

<style>
  /* apply selected theme globally */
  :global(body) {
    background-color: var(--global-bg);
    color: var(--global-text);
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }
  :global(#app),
  :global(.bg-white),
  :global(.bg-gray-100) {
    background-color: var(--global-bg);
    color: var(--global-text);
  }

  /* reset the color of buttons so the theme options are unaffected */
  :global(.toggle-option-button) {
    background-color: initial;
    color: initial;
  }
  :global(.toggle-option-button *) {
    background-color: transparent !important;
    color: inherit !important;
  }

  /* text input fields, making the box background a little darker or lighter for visibility
  depending on light or dark theme */
  :global(input),
  :global(select),
  :global(textarea) {
    background-color: var(--global-bg) !important;
    color: var(--global-text);

    background-image:
      linear-gradient(rgba(0, 0, 0, 0.07), rgba(0, 0, 0, 0.07)),
      linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.15));

    /* border for text input */
    border: 1px solid var(--global-text) !important;
    border-radius: 4px;
    padding: 4px;
  }

  /* heatmap sidebar */
  :global(.sticky.left-0),
  :global(.text-xs.md\:text-sm) {
    background-color: var(--global-bg);
    color: var(--global-text);
  }

  :global(div[style*='--background-color']) {
    --background-color: var(--global-bg);
    background-color: var(--global-bg);
    color: var(--global-text);
  }

  /* Blank tiles in heatmap inherit theme text color at low opacity */
  :global(.bg-slate-200),
  :global(.bg-slate-300) {
    background-color: var(--global-text);
    opacity: 0.15;
    border: 1px solid var(--global-bg) !important;
  }

  /* Active data tiles show actual color */
  :global(div[data-date][style*='background-color']) {
    opacity: 1;
  }
</style>
