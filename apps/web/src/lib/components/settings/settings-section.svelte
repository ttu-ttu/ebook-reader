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
    gap: 0.85rem;
    min-width: 0;
    scroll-margin-top: 5.5rem;
  }

  .settings-section-header h2 {
    font-size: 1.12rem;
    font-weight: 780;
    line-height: 1.2;
  }

  .settings-section-header p {
    margin-top: 0.3rem;
    color: var(--app-muted-fg);
    font-size: 0.86rem;
    font-weight: 600;
  }

  .settings-section-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.85rem;
    align-items: stretch;
  }

  @media (min-width: 1100px) {
    .settings-section-grid:not(.settings-section-grid-wide) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
