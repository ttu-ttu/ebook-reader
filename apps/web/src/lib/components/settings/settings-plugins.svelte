<script lang="ts">
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import SettingsSection from '$lib/components/settings/settings-section.svelte';
  import { enabledPlugins$, isPluginEnabled, plugins, setPluginEnabled } from '$lib/plugins';
</script>

<SettingsSection id="general-plugins" keywords="plugin extension">
  {#each plugins as plugin (plugin.id)}
    {@const enabled = isPluginEnabled(plugin.id, $enabledPlugins$)}
    <SettingsItemGroup title={plugin.name} tooltip={plugin.description}>
      <button
        type="button"
        role="switch"
        class="app-switch"
        aria-checked={enabled}
        aria-label={plugin.name}
        on:click={() => setPluginEnabled(plugin.id, !enabled)}
      >
        <span class="app-switch-thumb" />
        <span class="app-switch-text">{enabled ? 'On' : 'Off'}</span>
      </button>
    </SettingsItemGroup>
  {/each}
</SettingsSection>
