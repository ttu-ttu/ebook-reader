<script lang="ts">
  import { faSpinner, faUserPlus } from '@fortawesome/free-solid-svg-icons';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import { buttonClasses, inputClasses } from '$lib/css-classes';
  import {
    accountPermissions,
    addAccount,
    listAccounts,
    removeAccount,
    resetAccountPassword,
    setAccountAdmin,
    setAccountPermissions,
    type AccountPermission,
    type AccountUser,
    type AdminAccount
  } from '$lib/data/account';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';

  /** The signed-in admin. */
  export let self: AccountUser;

  const minPasswordLength = 8;

  let accounts: AdminAccount[] = [];
  let loading = true;
  let busy = false;
  let message = '';
  let error = '';
  let newUsername = '';
  let newPassword = '';
  let newAdmin = false;
  /** Username whose password is being reset. */
  let resetting = '';
  let resetPassword = '';

  onMount(refresh);

  async function refresh() {
    try {
      accounts = await listAccounts();
      error = '';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  /** Runs an admin action, shows its result and reloads the list. */
  async function run(action: () => Promise<unknown>, done: string) {
    busy = true;
    message = '';

    try {
      await action();
      error = '';
      message = done;
      await refresh();
      return true;
    } catch (e: any) {
      error = e.message;
      return false;
    } finally {
      busy = false;
    }
  }

  async function onAdd() {
    const username = newUsername.trim().toLowerCase();

    if (await run(() => addAccount(username, newPassword, newAdmin), `Added ${username}.`)) {
      newUsername = '';
      newPassword = '';
      newAdmin = false;
    }
  }

  async function onReset() {
    const username = resetting;

    if (
      await run(
        () => resetAccountPassword(username, resetPassword),
        `Changed the password of ${username} and signed out its devices.`
      )
    ) {
      resetting = '';
      resetPassword = '';
    }
  }

  function onToggleAdmin(account: AdminAccount) {
    run(
      () => setAccountAdmin(account.username, !account.admin),
      `${account.username} is ${account.admin ? 'no longer' : 'now'} an admin.`
    );
  }

  function onTogglePermission(account: AdminAccount, permission: AccountPermission) {
    const granted = account.permissions || [];
    const allowed = !granted.includes(permission);
    const label = accountPermissions.find(({ id }) => id === permission)?.label;

    run(
      () =>
        setAccountPermissions(
          account.username,
          allowed ? [...granted, permission] : granted.filter((name) => name !== permission)
        ),
      `${label}: ${allowed ? 'allowed' : 'no longer allowed'} for ${account.username}.`
    );
  }

  function onRemove(account: AdminAccount) {
    if (
      window.confirm(
        `Remove ${account.username}? They are signed out everywhere. Their reading data stays on the server.`
      )
    ) {
      run(() => removeAccount(account.username), `Removed ${account.username}.`);
    }
  }

  function formatDate(seconds: number) {
    return new Date(seconds * 1000).toLocaleDateString();
  }
</script>

<SettingsItemGroup
  title="Manage accounts"
  tooltip="Only admins see this. Set what each account may do under User permissions."
  wide
>
  {#if loading}
    <span class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Loading accounts...</span>
  {:else}
    <ul class="admin-accounts">
      {#each accounts as account (account.id)}
        <li>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-bold">{account.username}</span>
            {#if account.admin}<span class="admin-badge">admin</span>{/if}
            <span class="flex-1 text-xs text-[color:var(--app-muted-fg)]">
              since {formatDate(account.created)}
            </span>
            <button
              class={buttonClasses}
              disabled={busy}
              on:click={() => {
                resetting = resetting === account.username ? '' : account.username;
                resetPassword = '';
              }}>Reset password</button
            >
            <button
              class={buttonClasses}
              disabled={busy || account.id === self.id}
              title={account.id === self.id ? 'You cannot remove your own account' : ''}
              on:click={() => onRemove(account)}>Remove</button
            >
          </div>
          {#if resetting === account.username}
            <form class="mt-2 flex flex-wrap items-end gap-2" on:submit|preventDefault={onReset}>
              <input type="text" autocomplete="username" value={account.username} hidden readonly />
              <input
                type="password"
                autocomplete="new-password"
                placeholder="New password for {account.username}"
                aria-label="New password for {account.username}"
                minlength={minPasswordLength}
                required
                class="{inputClasses} max-w-xs"
                bind:value={resetPassword}
              />
              <button class={buttonClasses} disabled={busy}>Set password</button>
            </form>
          {/if}
        </li>
      {/each}
    </ul>

    <form class="admin-add" on:submit|preventDefault={onAdd}>
      <input
        type="text"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        placeholder="New username"
        aria-label="New username"
        pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{'{'}2,31{'}'}"
        title="3-32 characters: letters, digits, '.', '_' and '-'"
        required
        class={inputClasses}
        bind:value={newUsername}
      />
      <input
        type="password"
        autocomplete="new-password"
        placeholder="Password"
        aria-label="Password for the new account"
        minlength={minPasswordLength}
        required
        class={inputClasses}
        bind:value={newPassword}
      />
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={newAdmin} />
        Admin
      </label>
      <button class="{buttonClasses} flex items-center gap-2" disabled={busy}>
        <Fa icon={faUserPlus} />
        Add account
      </button>
    </form>
  {/if}
  {#if message}<p class="mt-2 text-sm" role="status">{message}</p>{/if}
  {#if error}<p class="admin-error" role="alert">{error}</p>{/if}
</SettingsItemGroup>

{#if !loading && accounts.length}
  <SettingsItemGroup
    title="User permissions"
    tooltip="What each account may do besides reading. Admins have every permission and manage accounts. Changes apply on the account's next page load."
    wide
  >
    <div class="overflow-x-auto">
      <table class="permissions-table">
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col" title="Manage accounts; has every permission">Admin</th>
            {#each accountPermissions as permission (permission.id)}
              <th scope="col" title={permission.description}>{permission.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each accounts as account (account.id)}
            <tr>
              <th scope="row">{account.username}</th>
              <td>
                <input
                  type="checkbox"
                  aria-label="{account.username} is an admin"
                  title={account.id === self.id ? 'Another admin has to change this' : ''}
                  checked={!!account.admin}
                  disabled={busy || account.id === self.id}
                  on:click|preventDefault={() => onToggleAdmin(account)}
                />
              </td>
              {#each accountPermissions as permission (permission.id)}
                <td>
                  <input
                    type="checkbox"
                    aria-label="{account.username}: {permission.description}"
                    title={account.admin ? 'Admins have every permission' : permission.description}
                    checked={!!account.admin || !!account.permissions?.includes(permission.id)}
                    disabled={busy || !!account.admin}
                    on:click|preventDefault={() => onTogglePermission(account, permission.id)}
                  />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </SettingsItemGroup>
{/if}

<style>
  .admin-accounts {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .admin-badge {
    border-radius: 9999px;
    background: color-mix(in srgb, var(--accent-color) 22%, var(--surface-strong-color));
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .admin-add {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    align-items: center;
    gap: 0.6rem;
    max-width: 44rem;
  }

  .permissions-table {
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .permissions-table th,
  .permissions-table td {
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--border-color);
    text-align: center;
  }

  .permissions-table th[scope='row'],
  .permissions-table thead th:first-child {
    text-align: left;
  }

  .admin-error {
    margin-top: 0.5rem;
    color: var(--app-danger-color);
    font-size: 0.875rem;
  }
</style>
