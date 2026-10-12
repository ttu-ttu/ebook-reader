<script lang="ts">
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import { optionsForToggle } from '$lib/components/button-toggle-group/toggle-option';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import SettingsThemePicker from '$lib/components/settings/settings-theme-picker.svelte';
  import { theme$ } from '$lib/data/store';
  import { darkTheme$, followSystemTheme$, systemDark$ } from '$lib/data/theme/theme-store';
</script>

<SettingsItemGroup
  title="Follow system theme"
  tooltip="Switch between a light and a dark theme together with your device's dark mode."
>
  <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={$followSystemTheme$} />
</SettingsItemGroup>

{#if $followSystemTheme$}
  <SettingsItemGroup
    title="Light theme"
    tooltip={$systemDark$ ? 'Used when the device is in light mode.' : 'In use now (light mode).'}
    wide
  >
    <SettingsThemePicker bind:value={$theme$} label="Light theme" />
  </SettingsItemGroup>
  <SettingsItemGroup
    title="Dark theme"
    tooltip={$systemDark$ ? 'In use now (dark mode).' : 'Used when the device is in dark mode.'}
    wide
  >
    <SettingsThemePicker bind:value={$darkTheme$} label="Dark theme" preferDark />
  </SettingsItemGroup>
{:else}
  <SettingsItemGroup title="Theme" tooltip="Applies to the library, settings and the book." wide>
    <SettingsThemePicker bind:value={$theme$} />
  </SettingsItemGroup>
{/if}

<p class="pt-3 text-sm">
  <a class="app-button app-button-quiet" href="?section=general#general-custom-themes">
    Make or import your own theme in Custom Themes
  </a>
</p>
