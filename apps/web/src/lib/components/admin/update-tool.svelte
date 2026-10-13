<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import { onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { getUpdateState, requestUpdate, type UpdateState } from '$lib/data/account';
  import {
    checkForUpdate,
    defaultUpdateRepo,
    updateChannel$,
    type UpdateCheck
  } from '$lib/data/app-update';

  const pollMs = 3000;
  const shownCommits = 30;
  const channelOptions = [
    { id: 'stable', text: 'Stable' },
    { id: 'edge', text: 'Bleeding edge' }
  ];

  let state: UpdateState | undefined;
  let check: UpdateCheck | undefined;
  let checking = false;
  let error = '';
  /** The commit asked for here, while waiting for the updater. */
  let updatingTo = '';
  let pollTimer: ReturnType<typeof setTimeout> | undefined;

  $: repo = state?.updater || defaultUpdateRepo;
  $: status = state?.status;
  $: canUpdate =
    !!state?.updater && !!check && check.latest !== check.current && check.state !== 'ahead';
  $: finished = !!updatingTo && status?.ref === updatingTo && status.state !== 'running';

  let mounted = false;

  onMount(() => (mounted = true));

  // Checks on opening and again when the channel changes.
  $: if (mounted && $updateChannel$) refresh();

  onDestroy(() => clearTimeout(pollTimer));

  async function refresh() {
    checking = true;
    error = '';

    try {
      state = await getUpdateState();

      const version = await (await fetch('/version.txt', { cache: 'no-store' })).text();

      check = await checkForUpdate(repo, version, $updateChannel$);
    } catch (e: any) {
      error = e.message;
    } finally {
      checking = false;
    }
  }

  async function update() {
    if (!check) {
      return;
    }

    error = '';

    try {
      state = await requestUpdate(check.latest);
      updatingTo = check.latest;
      poll();
    } catch (e: any) {
      error = e.message;
    }
  }

  /** The stack restarts during the update, so failed requests just mean "wait". */
  async function poll() {
    try {
      state = await getUpdateState();
    } catch {
      // Restarting
    }

    // `finished` only updates after this function returns.
    const latest = state?.status;

    if (!(latest?.ref === updatingTo && latest.state !== 'running')) {
      pollTimer = setTimeout(poll, pollMs);
    }
  }

  function short(sha: string) {
    return sha.slice(0, 8);
  }
</script>

<div class="flex flex-col gap-3 text-sm">
  <p>
    Compares this server with the latest release (stable) or the newest commit on main (bleeding
    edge) of
    <a class="underline" href="https://github.com/{repo}" target="_blank" rel="noreferrer">{repo}</a
    >. Updating downloads that version, rebuilds it on the server and restarts everything (about a
    minute of downtime; a running difficulty job stops).
  </p>

  <div>
    <ButtonToggleGroup options={channelOptions} bind:selectedOptionId={$updateChannel$} />
  </div>

  {#if checking}
    <p class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Checking GitHub...</p>
  {:else if check}
    <p>
      Running <code>{check.current ? short(check.current) : 'an unknown version'}</code>{check.dirty
        ? ' with local changes'
        : ''}.
      {#if check.state === 'current'}
        This is the latest version.
      {:else if check.state === 'behind'}
        <strong>{check.commits.length} newer commits</strong> in {check.target} (latest
        <code>{short(check.latest)}</code>).
      {:else if check.state === 'ahead'}
        This is newer than {check.target} on GitHub.
      {:else if check.state === 'diverged'}
        It has commits that aren't in {check.target}, which is at
        <code>{short(check.latest)}</code>.
      {:else}
        This version isn't on GitHub (a local build); {check.target} is at
        <code>{short(check.latest)}</code>.
      {/if}
    </p>
    {#if check.commits.length}
      <ul class="commit-list">
        {#each check.commits.slice(0, shownCommits) as commit (commit.sha)}
          <li><code>{short(commit.sha)}</code> {commit.message}</li>
        {/each}
        {#if check.commits.length > shownCommits}
          <li>... and {check.commits.length - shownCommits} more</li>
        {/if}
      </ul>
    {/if}
  {/if}

  {#if state && !state.updater}
    <p class="text-[color:var(--app-muted-fg)]">
      The updater isn't installed on this server. Servers set up with scripts/deploy.sh get it (it
      needs systemd and an absolute DATA_PATH); otherwise update as described in docs/INSTALL.md.
    </p>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <button class={buttonClasses} disabled={checking || !!updatingTo} on:click={refresh}>
      Check again
    </button>
    {#if canUpdate && !updatingTo && check}
      <button class={buttonClasses} on:click={update}>
        Update to {check.target === 'main' ? short(check.latest) : check.target}
      </button>
    {/if}
  </div>

  {#if updatingTo && !finished}
    <p class="flex items-center gap-2">
      <Fa icon={faSpinner} spin />
      {#if status?.ref === updatingTo}
        {status.message}...
      {:else}
        Waiting for the server's updater...
      {/if}
    </p>
  {:else if status}
    <p class={status.state === 'failed' ? 'text-[color:var(--app-danger-color)]' : ''}>
      {updatingTo ? '' : 'Last update: '}{status.message}
      (<code>{short(status.ref)}</code>, {new Date(status.at * 1000).toLocaleString()}).
      {#if finished && status.state === 'done'}
        <button class="underline" on:click={() => window.location.reload()}>Reload the page</button>
      {/if}
    </p>
  {/if}

  {#if error}
    <p class="text-[color:var(--app-danger-color)]">{error}</p>
  {/if}
</div>

<style>
  .commit-list {
    display: grid;
    max-height: 16rem;
    gap: 0.2rem;
    overflow-y: auto;
    padding-left: 1.1rem;
    list-style: disc;
  }
</style>
