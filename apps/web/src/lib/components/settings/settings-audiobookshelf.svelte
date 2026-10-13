<script lang="ts">
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import SettingsSection from '$lib/components/settings/settings-section.svelte';
  import { buttonClasses, inputClasses } from '$lib/css-classes';
  import { absLogin, audiobookshelfToken$ } from '$lib/data/audiobookshelf';

  let username = '';
  let password = '';
  let apiKey = '';
  let error = '';
  let busy = false;

  async function signIn() {
    busy = true;
    error = '';
    try {
      audiobookshelfToken$.next(await absLogin(username, password));
      password = '';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    busy = false;
  }
</script>

<SettingsSection id="audiobookshelf-connect" keywords="abs audiobook server token api key">
  {#if $audiobookshelfToken$}
    <SettingsItemGroup
      title="Connected"
      tooltip="Listen → Audiobookshelf streams the book's audiobook."
    >
      <button class={buttonClasses} on:click={() => audiobookshelfToken$.next('')}>
        Disconnect
      </button>
    </SettingsItemGroup>
  {:else}
    <SettingsItemGroup title="Username">
      <input aria-label="Username" class={inputClasses} autocomplete="off" bind:value={username} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Password" tooltip="Used once to get a token; not stored.">
      <input
        aria-label="Password"
        type="password"
        class={inputClasses}
        autocomplete="off"
        bind:value={password}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="">
      <button class={buttonClasses} disabled={busy || !username || !password} on:click={signIn}>
        Sign in
      </button>
    </SettingsItemGroup>
    <SettingsItemGroup title="Or an API key" tooltip="Audiobookshelf → Settings → API Keys.">
      <input
        aria-label="API key"
        type="password"
        class={inputClasses}
        autocomplete="off"
        bind:value={apiKey}
        on:change={() => apiKey.trim() && audiobookshelfToken$.next(apiKey.trim())}
      />
    </SettingsItemGroup>
    {#if error}
      <p class="text-danger" role="alert">{error}</p>
    {/if}
  {/if}
</SettingsSection>
