<script lang="ts" context="module">
  export type AppSection = 'library' | 'statistics' | 'settings' | 'notes';
</script>

<script lang="ts">
  import {
    faArrowLeft,
    faBook,
    faBookOpenReader,
    faChartLine,
    faGear,
    faNoteSticky,
    faUser
  } from '@fortawesome/free-solid-svg-icons';
  import AppHeaderLogo from '$lib/components/app-header/app-header-logo.svelte';
  import { account$ } from '$lib/data/account';
  import { pagePath } from '$lib/data/env';
  import Fa from 'svelte-fa';

  export let active: AppSection | undefined;
  export let currentBookId: number | undefined = undefined;
  /** Intercepts section links, e.g. so the reader can save progress before leaving. */
  export let onNavigate: ((section: AppSection, href: string) => void) | undefined = undefined;
  /** When set, small screens show a back button instead of the section navigation. */
  export let onBack: (() => void) | undefined = undefined;

  function navigate(event: MouseEvent, section: AppSection, href: string) {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(section, href);
    }
  }

  const sections: {
    key: AppSection;
    label: string;
    icon: typeof faBook;
    href: string;
  }[] = [
    { key: 'library', label: 'Library', icon: faBook, href: `${pagePath}/manage` },
    { key: 'statistics', label: 'Statistics', icon: faChartLine, href: `${pagePath}/statistics` },
    { key: 'settings', label: 'Settings', icon: faGear, href: `${pagePath}/settings` },
    { key: 'notes', label: 'Notes', icon: faNoteSticky, href: '' }
  ];
</script>

<header class="fixed inset-x-0 top-0 z-40">
  <div
    class="app-header-surface relative h-16 border-b border-[color:var(--app-header-border)] text-[color:var(--app-header-fg)] xl:h-[3.25rem]"
  >
    <div class="flex h-full items-center gap-2 px-3 sm:gap-6 sm:px-5 xl:px-8">
      {#if onBack}
        <button
          type="button"
          class="app-header-icon sm:hidden"
          title="Back"
          aria-label="Back"
          on:click={onBack}
        >
          <Fa icon={faArrowLeft} />
        </button>
      {/if}

      <a
        href="{pagePath}/manage"
        class="app-brand {onBack ? 'hidden sm:flex' : 'flex'}"
        title="Chimimouryou"
        on:click={(event) => navigate(event, 'library', `${pagePath}/manage`)}
      >
        <AppHeaderLogo label="Chimimouryou" />
      </a>

      <nav class="section-nav hidden sm:flex" aria-label="Sections">
        {#each sections as section (section.key)}
          {#if section.href}
            <a
              href={section.href}
              class="section-nav-item"
              class:section-nav-item-active={section.key === active}
              aria-current={section.key === active ? 'page' : undefined}
              title={section.label}
              on:click={(event) => navigate(event, section.key, section.href)}
            >
              <Fa icon={section.icon} class="md:hidden" />
              <span class="hidden md:inline">{section.label}</span>
            </a>
          {:else}
            <span
              class="section-nav-item section-nav-item-disabled"
              aria-disabled="true"
              title="{section.label} are not available in this reader yet"
            >
              <Fa icon={section.icon} class="md:hidden" />
              <span class="hidden md:inline">{section.label}</span>
            </span>
          {/if}
        {/each}
      </nav>

      <div class="ml-auto flex min-w-0 items-center gap-1">
        {#if currentBookId}
          <a
            href="{pagePath}/b?id={currentBookId}"
            class="app-header-icon app-header-continue"
            title="Continue reading"
          >
            <Fa icon={faBookOpenReader} />
            <span class="hidden lg:inline">Continue</span>
          </a>
        {/if}
        {#if $$slots.default}
          <div class="app-header-pill">
            <slot />
          </div>
        {/if}
        <a
          href="{pagePath}/settings?section=general#general-account"
          class="app-header-icon"
          title={$account$ ? `Signed in as ${$account$.username}` : 'Sign in'}
          aria-label={$account$ ? `Account: ${$account$.username}` : 'Sign in'}
        >
          {#if $account$}
            <span class="account-initial">{$account$.username.charAt(0)}</span>
          {:else}
            <Fa icon={faUser} />
          {/if}
        </a>
      </div>
    </div>
  </div>
</header>

{#if !onBack}
  <nav class="app-bottom-nav" aria-label="Sections">
    {#each sections as section (section.key)}
      {#if section.href}
        <a
          href={section.href}
          class="bottom-nav-item"
          class:bottom-nav-item-active={section.key === active}
          aria-current={section.key === active ? 'page' : undefined}
          on:click={(event) => navigate(event, section.key, section.href)}
        >
          <Fa icon={section.icon} />
          <span>{section.label}</span>
        </a>
      {/if}
    {/each}
  </nav>
{/if}

<style>
  .app-brand {
    flex-shrink: 0;
    align-items: center;
    color: var(--accent-color);
  }

  .account-initial {
    display: inline-flex;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--app-header-border);
    border-radius: 9999px;
    color: var(--app-header-fg);
    font-family: var(--app-font-display);
    font-size: 0.85rem;
    text-transform: uppercase;
  }

  .section-nav {
    height: 100%;
    min-width: 0;
    align-items: stretch;
    gap: 0.25rem;
  }

  .section-nav-item {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.7rem;
    color: var(--app-header-icon-fg);
    font-size: var(--app-header-label-size);
    font-weight: 500;
    white-space: nowrap;
    transition: color 0.15s var(--app-ease);
  }

  .section-nav-item::after {
    content: '';
    position: absolute;
    inset: auto 0.7rem -1px;
    height: 2px;
    background: transparent;
  }

  .section-nav-item:hover:not(.section-nav-item-disabled),
  .section-nav-item-active {
    color: var(--app-header-fg);
  }

  .section-nav-item-active {
    font-weight: 650;
  }

  .section-nav-item-active::after {
    background: var(--accent-color);
  }

  .section-nav-item:focus-visible {
    outline: 2px solid var(--app-focus-ring);
    outline-offset: -4px;
  }

  .section-nav-item-disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .app-bottom-nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    display: none;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid var(--app-header-border);
    background: var(--app-header-bg);
    -webkit-backdrop-filter: blur(var(--app-blur));
    backdrop-filter: blur(var(--app-blur));
  }

  @media (max-width: 639px) {
    .app-bottom-nav {
      display: grid;
    }
  }

  .bottom-nav-item {
    position: relative;
    display: flex;
    min-height: 3.5rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    color: var(--app-header-icon-fg);
    font-size: 0.7rem;
    font-weight: 500;
  }

  .bottom-nav-item-active {
    color: var(--accent-strong-color);
    font-weight: 650;
  }

  .bottom-nav-item-active::before {
    content: '';
    position: absolute;
    top: -1px;
    width: 1.5rem;
    height: 2px;
    background: var(--accent-color);
  }
</style>
