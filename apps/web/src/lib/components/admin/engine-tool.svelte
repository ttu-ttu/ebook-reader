<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import { onDestroy, onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { buttonClasses } from '$lib/css-classes';
  import { getUpdateState, requestEngineUpdate, type UpdateState } from '$lib/data/account';
  import { checkEngineRelease, engineRepo } from '$lib/data/app-update';

  const pollMs = 3000;

  let check: Awaited<ReturnType<typeof checkEngineRelease>> | undefined;
  let state: UpdateState | undefined;
  let checking = false;
  let error = '';
  /** The release asked for here, while waiting for the updater. */
  let updatingTo = '';
  let pollTimer: ReturnType<typeof setTimeout> | undefined;

  $: status = state?.status;
  $: finished = !!updatingTo && status?.ref === updatingTo && status.state !== 'running';
  $: canUpdate = !!state?.updater && !!check?.newer && check.webBuild;

  onMount(refresh);
  onDestroy(() => clearTimeout(pollTimer));

  async function refresh() {
    checking = true;
    error = '';

    try {
      state = await getUpdateState().catch(() => undefined);

      const response = await fetch('/vn/conscripter-version.txt', { cache: 'no-store' });

      check = await checkEngineRelease(response.ok ? await response.text() : 'unknown');
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
      state = await requestEngineUpdate(check.latest);
      updatingTo = check.latest;
      poll();
    } catch (e: any) {
      error = e.message;
    }
  }

  /** The web container restarts during the update, so failed requests just mean "wait". */
  async function poll() {
    try {
      state = await getUpdateState();
    } catch {
      // Restarting
    }

    const latest = state?.status;

    if (!(latest?.ref === updatingTo && latest.state !== 'running')) {
      pollTimer = setTimeout(poll, pollMs);
    }
  }
</script>

<div class="flex flex-col gap-3 text-sm">
  <p>
    Visual novels play on
    <a class="underline" href="https://github.com/{engineRepo}" target="_blank" rel="noreferrer"
      >CONscripter</a
    >. A new release isn't installed on its own: "Install" downloads the release's web build on the
    server (nothing is compiled) and rebuilds the web container so browsers fetch the new engine (a
    few seconds of downtime; other services keep running). Without the server's updater, run
    <code>scripts/conscripter/build.sh</code>, commit the files it changes and deploy.
  </p>

  {#if checking}
    <p class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Checking GitHub...</p>
  {:else if check}
    <p>
      Installed: <span class="font-semibold">{check.installed}</span>. Latest release:
      <a class="underline" href={check.url} target="_blank" rel="noreferrer">{check.latest}</a>.
    </p>
    <p class="font-semibold">
      {#if !check.newer}
        Up to date.
      {:else if check.webBuild}
        {check.latest} is available.
      {:else}
        {check.latest} has no web build yet; check again later.
      {/if}
    </p>
  {/if}

  {#if state && !state.updater && check?.newer}
    <p class="text-[color:var(--app-muted-fg)]">
      The updater isn't installed on this server (servers set up with scripts/deploy.sh have it).
    </p>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <button class={buttonClasses} disabled={checking || !!updatingTo} on:click={refresh}>
      Check again
    </button>
    {#if canUpdate && !updatingTo && check}
      <button class={buttonClasses} on:click={update}>Install {check.latest}</button>
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
  {:else if finished && status}
    <p class={status.state === 'failed' ? 'text-danger' : ''}>
      {status.message} ({new Date(status.at * 1000).toLocaleString()}).
      {#if status.state === 'done'}
        <button class="underline" on:click={() => window.location.reload()}>Reload the page</button>
      {/if}
    </p>
  {/if}

  {#if error}
    <p class="text-danger">{error}</p>
  {/if}
</div>
