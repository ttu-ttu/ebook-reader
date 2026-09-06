<script lang="ts">
  export let attached: boolean = true;
  export let orientation: 'horizontal' | 'vertical' = 'horizontal';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  let customClass: string = '';
  export { customClass as class };
</script>

<div
  role="group"
  class="astryx-button-group {customClass}"
  class:is-attached={attached}
  data-orientation={orientation}
  data-size={size}
  {...$$restProps}
>
  <slot />
</div>

<style>
  .astryx-button-group {
    display: inline-flex;
    position: relative;
    box-sizing: border-box;
    align-items: center;
  }

  [data-orientation='horizontal'] {
    flex-direction: row;
  }

  [data-orientation='vertical'] {
    flex-direction: column;
    align-items: stretch;
  }

  /* Attached horizontal styling */
  .is-attached[data-orientation='horizontal'] > :global(.astryx-button),
  .is-attached[data-orientation='horizontal'] > :global(.astryx-icon-button),
  .is-attached[data-orientation='horizontal'] > :global(.astryx-toggle-button),
  .is-attached[data-orientation='horizontal'] > :global(button) {
    border-radius: 0;
  }

  .is-attached[data-orientation='horizontal'] > :global(*:not(:first-child)) {
    margin-left: -1px;
  }

  .is-attached[data-orientation='horizontal'] > :global(*:first-child) {
    border-top-left-radius: var(--astryx-radius-md, 6px);
    border-bottom-left-radius: var(--astryx-radius-md, 6px);
  }

  .is-attached[data-orientation='horizontal'] > :global(*:last-child) {
    border-top-right-radius: var(--astryx-radius-md, 6px);
    border-bottom-right-radius: var(--astryx-radius-md, 6px);
  }

  /* Attached vertical styling */
  .is-attached[data-orientation='vertical'] > :global(.astryx-button),
  .is-attached[data-orientation='vertical'] > :global(.astryx-icon-button),
  .is-attached[data-orientation='vertical'] > :global(.astryx-toggle-button),
  .is-attached[data-orientation='vertical'] > :global(button) {
    border-radius: 0;
  }

  .is-attached[data-orientation='vertical'] > :global(*:not(:first-child)) {
    margin-top: -1px;
  }

  .is-attached[data-orientation='vertical'] > :global(*:first-child) {
    border-top-left-radius: var(--astryx-radius-md, 6px);
    border-top-right-radius: var(--astryx-radius-md, 6px);
  }

  .is-attached[data-orientation='vertical'] > :global(*:last-child) {
    border-bottom-left-radius: var(--astryx-radius-md, 6px);
    border-bottom-right-radius: var(--astryx-radius-md, 6px);
  }

  /* Elevation and stacking */
  .is-attached > :global(*:hover),
  .is-attached > :global(*:focus-visible),
  .is-attached > :global(*[aria-pressed='true']),
  .is-attached > :global(*.is-selected) {
    z-index: 1;
  }

  /* Detached spacing */
  .astryx-button-group:not(.is-attached)[data-orientation='horizontal'] {
    gap: var(--astryx-space-2, 8px);
  }
  .astryx-button-group:not(.is-attached)[data-orientation='vertical'] {
    gap: var(--astryx-space-2, 8px);
  }
</style>
