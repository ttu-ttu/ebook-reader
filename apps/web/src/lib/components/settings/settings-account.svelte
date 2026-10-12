<script lang="ts">
  import {
    faArrowRightFromBracket,
    faRightToBracket,
    faRotate,
    faSpinner,
    faUserShield
  } from '@fortawesome/free-solid-svg-icons';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import { buttonClasses, inputClasses } from '$lib/css-classes';
  import {
    account$,
    accountConfig,
    canOpenAdminPanel,
    changePassword,
    httpsAppUrl,
    isInsecurePage,
    signIn,
    signInAvailableHere,
    signOut
  } from '$lib/data/account';
  import {
    readerProfile,
    readerProfileLabels,
    settingsSyncState$,
    syncAccountSettings
  } from '$lib/data/account-settings-sync';
  import { pagePath } from '$lib/data/env';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';

  const minPasswordLength = 8;
  const insecure = isInsecurePage();
  const secureUrl = signInAvailableHere() ? '' : httpsAppUrl();

  /** HTTPS, or plain HTTP when the server allows it (checked on mount). */
  let available = signInAvailableHere();
  let checkingHttp = insecure;
  /** The first admin hasn't signed in yet: its password is on the server. */
  let initialAdmin = false;

  $: profileLabel = available || $account$ ? readerProfileLabels[readerProfile()] : '';

  let busy = false;
  let error = '';
  let username = '';
  let password = '';
  let currentPassword = '';
  let newPassword = '';
  let passwordMessage = '';

  $: user = $account$;
  $: syncState = $settingsSyncState$;

  onMount(async () => {
    const config = await accountConfig();

    initialAdmin = config.initialAdmin;
    if (insecure) {
      available = config.httpAccounts;
      checkingHttp = false;
    }
  });

  /** Runs an action with the busy flag set; returns its error message, if any. */
  async function run(action: () => Promise<unknown>): Promise<string> {
    busy = true;

    try {
      await action();
      return '';
    } catch (e: any) {
      return e.message;
    } finally {
      busy = false;
    }
  }

  async function onSignIn() {
    // Reload afterwards so the library and reader load the account's data.
    error = await run(async () => {
      await signIn(username, password);
      window.location.reload();
    });
    password = '';
  }

  async function onSignOut() {
    error = await run(async () => {
      await signOut();
      window.location.reload();
    });
  }

  async function onChangePassword() {
    const failure = await run(() => changePassword(currentPassword, newPassword));

    passwordMessage = failure || 'Password changed. Other devices have been signed out.';

    if (!failure) {
      currentPassword = '';
      newPassword = '';
    }
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if user}
  <SettingsItemGroup title="Signed in" wide>
    {#if insecure}
      <p class="account-warning" role="alert">
        <strong>Not encrypted.</strong> This page uses plain HTTP, so your password, your session
        and the settings that sync with your account (including AI API keys) can be read by
        anyone who can watch this network. Passwords set in Manage accounts travel the same way.
        If this server has an HTTPS address, use
        <a class="font-semibold underline" href="{secureUrl}/settings?section=general#general-account"
          >{secureUrl.replace('https://', '')}</a
        > instead.
      </p>
    {/if}
    <div class="flex flex-wrap items-center gap-4">
      <span class="account-avatar">{user.username.charAt(0)}</span>
      <span class="min-w-0 flex-1 truncate font-bold">{user.username}</span>
      <button class="{buttonClasses} flex items-center gap-2" disabled={busy} on:click={onSignOut}>
        <Fa icon={faArrowRightFromBracket} />
        Sign out
      </button>
    </div>
    {#if error}<p class="account-error">{error}</p>{/if}
  </SettingsItemGroup>

  <SettingsItemGroup
    title="What syncs"
    tooltip="Stored in your account on this server, so every browser and device you sign in on shares them."
  >
    <ul class="account-list">
      <li>Reading progress, statistics, reading goals and highlights of Calibre books</li>
      <li>
        AI settings and themes. API keys are removed from this browser when you sign out
      </li>
      <li>
        Reader settings, kept separately for phones and for desktops and tablets (this device:
        {profileLabel})
      </li>
    </ul>
    <p class="mt-2 text-xs text-[color:var(--app-muted-fg)]">
      Books themselves are shared by everyone using this server.
    </p>
  </SettingsItemGroup>

  <SettingsItemGroup title="Settings sync">
    <div class="flex flex-wrap items-center gap-3">
      <span class="sync-status" data-state={syncState.state}>
        <span class="sync-dot" />
        {#if syncState.state === 'syncing'}
          Syncing...
        {:else if syncState.state === 'synced'}
          Synced at {formatTime(syncState.at)}
        {:else if syncState.state === 'error'}
          {syncState.message}
        {:else}
          Not started
        {/if}
      </span>
      <button
        class="sync-refresh"
        title="Sync now"
        disabled={syncState.state === 'syncing'}
        on:click={syncAccountSettings}
      >
        <Fa icon={faRotate} spin={syncState.state === 'syncing'} />
      </button>
    </div>
  </SettingsItemGroup>

  {#if user.temporaryPassword}
    <SettingsItemGroup title="Temporary password" wide>
      <p class="account-warning" role="alert">
        You signed in with the password generated when this server was set up. Change it below.
      </p>
    </SettingsItemGroup>
  {/if}

  <SettingsItemGroup
    title="Change password"
    tooltip="At least {minPasswordLength} characters. Signs out your other devices."
  >
    <form class="flex flex-col gap-2" on:submit|preventDefault={onChangePassword}>
      <input type="text" autocomplete="username" value={user.username} hidden readonly />
      <input
        type="password"
        autocomplete="current-password"
        placeholder="Current password"
        aria-label="Current password"
        required
        class={inputClasses}
        bind:value={currentPassword}
      />
      <input
        type="password"
        autocomplete="new-password"
        placeholder="New password"
        aria-label="New password"
        minlength={minPasswordLength}
        required
        class={inputClasses}
        bind:value={newPassword}
      />
      <button class="{buttonClasses} self-start" disabled={busy}>Change password</button>
      {#if passwordMessage}<p class="text-sm">{passwordMessage}</p>{/if}
    </form>
  </SettingsItemGroup>

  {#if canOpenAdminPanel(user)}
    <SettingsItemGroup
      title="Admin panel"
      tooltip="Manage accounts and permissions, and run server tools such as difficulty estimates."
    >
      <a class="{buttonClasses} inline-flex items-center gap-2 self-start" href="{pagePath}/admin">
        <Fa icon={faUserShield} />
        Open admin panel
      </a>
    </SettingsItemGroup>
  {/if}
{:else if user === undefined}
  <SettingsItemGroup title="Account" wide>
    <span class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Checking sign-in...</span>
  </SettingsItemGroup>
{:else}
  <SettingsItemGroup
    title="Sign in"
    tooltip="Keeps reading progress, statistics, highlights, AI settings and themes in your account on this server, shared by every device you sign in on. Accounts are created by an admin (admin panel) or on the server with ebook-account add NAME."
    wide
  >
    {#if checkingHttp}
      <span class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Checking sign-in...</span>
    {:else if available}
      {#if insecure}
        <p class="account-warning" role="alert">
          <strong>Not encrypted.</strong> This server allows signing in over plain HTTP. Your
          password and session will be sent unencrypted and can be read by anyone who can watch
          this network. If this server has an HTTPS address, sign in at
          <a class="font-semibold underline" href="{secureUrl}/settings?section=general#general-account"
            >{secureUrl.replace('https://', '')}</a
          > instead.
        </p>
      {/if}
      {#if initialAdmin}
        <p class="mb-3 text-sm">
          <strong>First start:</strong> sign in as <code>admin</code> with the temporary password
          shown at the end of the deploy, or on the server with
          <code>ebook-account initial-admin</code> (or <code>docker compose logs account</code>).
        </p>
      {/if}
      <form class="account-form" on:submit|preventDefault={onSignIn}>
        <input
          type="text"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          placeholder="Username"
          aria-label="Username"
          required
          class={inputClasses}
          bind:value={username}
        />
        <input
          type="password"
          autocomplete="current-password"
          placeholder="Password"
          aria-label="Password"
          required
          class={inputClasses}
          bind:value={password}
        />
        <button class="{buttonClasses} flex items-center gap-2" disabled={busy}>
          <Fa icon={busy ? faSpinner : faRightToBracket} spin={busy} />
          Sign in
        </button>
      </form>
      {#if error}<p class="account-error">{error}</p>{/if}
    {:else}
      <p class="text-sm">
        Signing in only works on the secure address. Open
        <a
          class="font-semibold underline"
          href="{secureUrl}/settings?section=general#general-account"
          >{secureUrl.replace('https://', '')}</a
        > to sign in.
      </p>
    {/if}
  </SettingsItemGroup>
{/if}

<style>
  .account-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    align-items: center;
    gap: 0.6rem;
    max-width: 44rem;
  }

  .account-warning {
    margin-bottom: 0.75rem;
    border: 1px solid color-mix(in srgb, #f59e0b 55%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
    padding: 0.6rem 0.8rem;
    font-size: 0.875rem;
    line-height: 1.45;
  }

  .account-error {
    margin-top: 0.5rem;
    color: var(--app-danger-color);
    font-size: 0.875rem;
  }

  .account-avatar {
    display: inline-flex;
    width: 2.75rem;
    height: 2.75rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--accent-color) 22%, var(--surface-strong-color));
    font-size: 1.2rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .account-list {
    display: grid;
    gap: 0.3rem;
    padding-left: 1.1rem;
    font-size: 0.88rem;
    list-style: disc;
  }

  .sync-status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: color-mix(in srgb, var(--font-color) 70%, transparent);
    font-size: 0.86rem;
    font-weight: 650;
  }

  .sync-status[data-state='error'] {
    color: var(--app-danger-color);
  }

  .sync-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--font-color) 26%, transparent);
  }

  .sync-status[data-state='syncing'] .sync-dot {
    background: #f59e0b;
  }

  .sync-status[data-state='synced'] .sync-dot {
    background: #16a34a;
  }

  .sync-status[data-state='error'] .sync-dot {
    background: #dc2626;
  }

  .sync-refresh {
    display: inline-flex;
    width: 1.9rem;
    height: 1.9rem;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--font-color) 8%, var(--border-color));
    border-radius: 9999px;
    background: color-mix(in srgb, var(--font-color) 5%, transparent);
    font-size: 0.8rem;
  }

  .sync-refresh:disabled {
    opacity: 0.45;
  }
</style>
