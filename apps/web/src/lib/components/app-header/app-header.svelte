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
    accent: string;
  }[] = [
    {
      key: 'library',
      label: 'Library',
      icon: faBook,
      href: `${pagePath}/manage`,
      accent: 'color-mix(in srgb, var(--accent-color) 26%, #8b5cf6)'
    },
    {
      key: 'statistics',
      label: 'Statistics',
      icon: faChartLine,
      href: `${pagePath}/statistics`,
      accent: 'color-mix(in srgb, var(--accent-color) 36%, #22c55e)'
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: faGear,
      href: `${pagePath}/settings`,
      accent: 'color-mix(in srgb, var(--accent-color) 34%, #3b82f6)'
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: faNoteSticky,
      href: '',
      accent: 'color-mix(in srgb, var(--accent-color) 18%, #f59e0b)'
    }
  ];
</script>

<header class="fixed inset-x-0 top-0 z-40">
  <div
    class="app-header-surface relative h-16 border-b border-[color:var(--app-header-border)] text-[color:var(--app-header-fg)] shadow-[inset_0_-1px_0_var(--app-header-border)] xl:h-[3.25rem]"
  >
    <div
      class="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 md:px-8 xl:px-10"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <a
          href="{pagePath}/manage"
          class="hidden shrink-0 items-center opacity-95 transition-opacity hover:opacity-100 sm:flex"
          title="ッツ Ebook Reader"
          on:click={(event) => navigate(event, 'library', `${pagePath}/manage`)}
        >
          <AppHeaderLogo />
        </a>

        {#if onBack}
          <div class="app-header-pill sm:hidden">
            <button
              type="button"
              class="app-header-icon"
              title="Back"
              aria-label="Back"
              on:click={onBack}
            >
              <Fa icon={faArrowLeft} />
            </button>
          </div>
        {/if}

        <nav
          class="section-nav app-header-pill min-w-0"
          class:section-nav-backable={!!onBack}
          aria-label="Section navigation"
        >
          {#if currentBookId}
            <a
              href="{pagePath}/b?id={currentBookId}"
              class="section-nav-item section-nav-item-return"
              title="Continue reading"
            >
              <Fa icon={faBookOpenReader} />
              <span class="hidden lg:inline">Continue</span>
            </a>
          {/if}
          {#each sections as section (section.key)}
            {#if section.href}
              <a
                href={section.href}
                class="section-nav-item"
                class:section-nav-item-active={section.key === active}
                aria-current={section.key === active ? 'page' : undefined}
                title={section.label}
                style:--section-nav-item-accent={section.accent}
                on:click={(event) => navigate(event, section.key, section.href)}
              >
                <Fa icon={section.icon} />
                <span class="hidden md:inline">{section.label}</span>
              </a>
            {:else}
              <span
                class="section-nav-item section-nav-item-disabled"
                aria-disabled="true"
                title="{section.label} are not available in this reader yet"
                style:--section-nav-item-accent={section.accent}
              >
                <Fa icon={section.icon} />
                <span class="hidden md:inline">{section.label}</span>
              </span>
            {/if}
          {/each}
        </nav>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        {#if $$slots.default}
          <div class="app-header-pill">
            <slot />
          </div>
        {/if}
        <div class="app-header-pill">
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
  </div>
</header>

<style>
  .account-initial {
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--accent-color) 24%, var(--surface-strong-color));
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .section-nav {
    /* Shrink and scroll instead of sliding under the actions on narrow screens. */
    flex-shrink: 1;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .section-nav-item {
    position: relative;
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    min-height: var(--app-header-control-height);
    padding: 0.55rem 0.85rem;
    border-radius: 1rem;
    color: var(--app-header-icon-fg);
    font-size: var(--app-header-label-size);
    font-weight: 700;
    line-height: 1.18;
    white-space: nowrap;
    transition:
      background-color 0.18s ease,
      color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .section-nav-item:hover:not(.section-nav-item-active):not(.section-nav-item-disabled) {
    background: color-mix(in srgb, var(--section-nav-item-accent) 14%, transparent);
    color: color-mix(in srgb, var(--section-nav-item-accent) 72%, var(--app-header-fg));
  }

  .section-nav-item-active {
    background: color-mix(in srgb, var(--section-nav-item-accent) 16%, var(--surface-strong-color));
    box-shadow:
      inset 0 1px rgba(255, 255, 255, 0.24),
      0 16px 30px -28px var(--shadow-color);
    color: color-mix(in srgb, var(--section-nav-item-accent) 76%, var(--font-color));
    cursor: default;
  }

  .section-nav-item-return {
    --section-nav-item-accent: color-mix(in srgb, var(--accent-color) 58%, #14b8a6);
    margin-right: 0.35rem;
  }

  .section-nav-item-disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  @media (max-width: 767px) {
    .section-nav-item {
      padding-inline: 0.7rem;
    }
  }

  @media (max-width: 639px) {
    .section-nav-backable {
      display: none;
    }

    .section-nav-item {
      padding-inline: 0.55rem;
    }

    .section-nav-item-disabled {
      display: none;
    }
  }
</style>
