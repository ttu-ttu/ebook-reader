<script lang="ts">
  import { faScrewdriverWrench, faSpinner, faUsers } from '@fortawesome/free-solid-svg-icons';
  import { onMount } from 'svelte';
  import { map, share } from 'rxjs';
  import Fa from 'svelte-fa';
  import AppHeader from '$lib/components/app-header/app-header.svelte';
  import SeriesTool from '$lib/components/admin/series-tool.svelte';
  import UpdateTool from '$lib/components/admin/update-tool.svelte';
  import DifficultyPanel from '$lib/components/book-card/difficulty-panel.svelte';
  import SettingsAdmin from '$lib/components/settings/settings-admin.svelte';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import { account$, canOpenAdminPanel, hasPermission } from '$lib/data/account';
  import { pagePath } from '$lib/data/env';
  import { database } from '$lib/data/store';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  type Tab = 'accounts' | 'tools';

  const currentBookId$ = database.lastItem$.pipe(
    map((item) => item?.dataId),
    share()
  );

  let tab: Tab = 'accounts';

  // The server refuses admin and tool requests without the right account;
  // this only keeps the controls away from people who can't use them.
  $: user = $account$;
  $: tabs = [
    { id: 'accounts' as Tab, label: 'Accounts', icon: faUsers, show: !!user?.admin },
    {
      id: 'tools' as Tab,
      label: 'Tools',
      icon: faScrewdriverWrench,
      show: hasPermission(user, 'difficulty')
    }
  ].filter((candidate) => candidate.show);
  $: if (tabs.length && !tabs.some((candidate) => candidate.id === tab)) {
    tab = tabs[0].id;
  }

  onMount(() => {
    const requested = new URL(window.location.href).searchParams.get('tab');

    if (requested === 'accounts' || requested === 'tools') {
      tab = requested;
    }
  });
</script>

<svelte:head>
  <title>{formatPageTitle('Admin')}</title>
</svelte:head>

<div class="app-page-shell">
  <AppHeader active={undefined} currentBookId={$currentBookId$} />

  <main class="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-28 pt-[5.25rem] md:px-8">
    <h1 class="admin-title">Admin panel</h1>

    {#if user === undefined}
      <p class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Checking sign-in...</p>
    {:else if !canOpenAdminPanel(user)}
      <SettingsItemGroup title="No access" wide>
        <p class="text-sm">
          {user ? 'This account' : 'You need to sign in with an account that'} can't use the admin
          panel. <a class="underline" href="{pagePath}/settings?section=general#general-account"
            >Account settings</a
          >
        </p>
      </SettingsItemGroup>
    {:else}
      <div class="admin-tabs" role="tablist">
        {#each tabs as candidate (candidate.id)}
          <button
            role="tab"
            class="admin-tab"
            aria-selected={tab === candidate.id}
            on:click={() => (tab = candidate.id)}
          >
            <Fa icon={candidate.icon} />
            {candidate.label}
          </button>
        {/each}
      </div>

      <div class="grid gap-[0.85rem]" role="tabpanel">
        {#if tab === 'accounts' && user?.admin}
          <SettingsAdmin self={user} />
        {:else if tab === 'tools'}
          {#if user?.admin}
            <SettingsItemGroup title="Updates" wide>
              <UpdateTool />
            </SettingsItemGroup>
            <SettingsItemGroup title="Series" wide>
              <SeriesTool />
            </SettingsItemGroup>
          {/if}
          {#if hasPermission(user, 'difficulty')}
            <SettingsItemGroup title="Estimate difficulty" wide>
              <DifficultyPanel />
            </SettingsItemGroup>
          {/if}
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  .admin-title {
    font-size: 1.35rem;
    font-weight: 780;
    line-height: 1.1;
  }

  .admin-tabs {
    display: flex;
    gap: 0.4rem;
    border-bottom: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
  }

  .admin-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: -1px;
    padding: 0.5rem 0.9rem;
    border-bottom: 2px solid transparent;
    color: var(--app-muted-fg);
    font-size: 0.9rem;
    font-weight: 650;
  }

  .admin-tab[aria-selected='true'] {
    border-bottom-color: var(--accent-color);
    color: var(--font-color);
  }
</style>
