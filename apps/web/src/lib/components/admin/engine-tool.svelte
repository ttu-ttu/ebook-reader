<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { buttonClasses } from '$lib/css-classes';
  import { checkEngineRelease, engineRepo } from '$lib/data/app-update';

  let check: Awaited<ReturnType<typeof checkEngineRelease>> | undefined;
  let checking = false;
  let error = '';

  onMount(refresh);

  async function refresh() {
    checking = true;
    error = '';

    try {
      const response = await fetch('/vn/conscripter-version.txt', { cache: 'no-store' });

      check = await checkEngineRelease(response.ok ? await response.text() : 'unknown');
    } catch (e: any) {
      error = e.message;
    } finally {
      checking = false;
    }
  }
</script>

<div class="flex flex-col gap-3 text-sm">
  <p>
    Visual novels play on
    <a class="underline" href="https://github.com/{engineRepo}" target="_blank" rel="noreferrer"
      >CONscripter</a
    >. A new release isn't installed on its own: run <code>scripts/conscripter/build.sh</code>,
    commit the files it changes and deploy (or use Updates once the commit is on GitHub).
  </p>

  {#if checking}
    <p class="flex items-center gap-2"><Fa icon={faSpinner} spin /> Checking GitHub...</p>
  {:else if error}
    <p class="text-danger">{error}</p>
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

  <div class="flex flex-wrap items-center gap-2">
    <button class={buttonClasses} disabled={checking} on:click={refresh}>Check again</button>
  </div>
</div>
