<script lang="ts">
  import { findSettingsSection, getSettingsView } from './settings-sections';

  /** Id from settings-sections.ts; title, description and order come from there. */
  export let id: string;
  /** Extra words the settings search should match for content without items */
  export let keywords = '';
  /** Single column, for editors and lists */
  export let wide = false;

  const view = getSettingsView();
  const info = findSettingsSection(id);

  $: visible = !$view || !!$view.query.trim() || $view.area === info?.area;
</script>

{#if visible && info}
  <section
    {id}
    class="settings-section"
    style:order={info.order}
    data-settings-section
    data-settings-search="{info.label} {info.description} {keywords}"
    aria-labelledby="{id}-heading"
  >
    <header class="settings-section-header">
      <h2 id="{id}-heading">{info.label}</h2>
      <p>{info.description}</p>
    </header>
    <div class="settings-section-grid" class:settings-section-grid-wide={wide}>
      <slot />
    </div>
  </section>
{/if}

<style>
  .settings-section {
    display: grid;
    min-width: 0;
    scroll-margin-top: 5.5rem;
  }

  .settings-section-header {
    padding-bottom: 0.6rem;
    border-bottom: 1px solid color-mix(in srgb, var(--font-color) 22%, var(--border-color));
  }

  .settings-section-header h2 {
    font-family: var(--app-font-display);
    font-size: 1.3rem;
    font-weight: 400;
    line-height: 1.3;
  }

  .settings-section-header p {
    margin-top: 0.2rem;
    color: var(--app-muted-fg);
    font-size: 0.82rem;
  }

  /* A single column of rows (settings-item-group.svelte); "wide" sections hold editors. */
  .settings-section-grid {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .settings-section-grid-wide {
    padding-top: 1rem;
  }
</style>
