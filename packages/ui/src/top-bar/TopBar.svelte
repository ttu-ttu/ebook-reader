<script lang="ts">
  export let fixed: boolean = false;
  export let sticky: boolean = false;
  export let translucent: boolean = false;
  export let bordered: boolean = true;
  export let density: 'compact' | 'normal' = 'normal';
  let customClass: string = '';
  export { customClass as class };
</script>

<header
  class="astryx-top-bar {customClass}"
  class:is-fixed={fixed}
  class:is-sticky={sticky}
  class:is-translucent={translucent}
  class:is-bordered={bordered}
  data-density={density}
  {...$$restProps}
>
  <div class="astryx-top-bar-inner">
    {#if $$slots.start}
      <div class="astryx-top-bar-start">
        <slot name="start" />
      </div>
    {/if}

    <div class="astryx-top-bar-center" class:has-start={$$slots.start} class:has-end={$$slots.end}>
      <slot />
    </div>

    {#if $$slots.end}
      <div class="astryx-top-bar-end">
        <slot name="end" />
      </div>
    {/if}
  </div>
</header>

<style>
  .astryx-top-bar {
    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    font-family: var(--astryx-font-family-sans, sans-serif);
    color: var(--astryx-color-fg-primary, #18181b);
    background-color: var(--astryx-color-surface, #ffffff);
    transition:
      background-color var(--astryx-duration-fast, 120ms) ease,
      border-color var(--astryx-duration-fast, 120ms) ease;
  }

  .astryx-top-bar.is-fixed {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
  }

  .astryx-top-bar.is-sticky {
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .astryx-top-bar.is-translucent {
    background-color: color-mix(in srgb, var(--astryx-color-surface, #ffffff) 85%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .astryx-top-bar.is-bordered {
    border-bottom: 1px solid var(--astryx-color-border-subtle, #e4e4e7);
  }

  [data-density='normal'] {
    height: 48px;
  }
  @media (min-width: 1280px) {
    [data-density='normal'] {
      height: 44px;
    }
  }

  [data-density='compact'] {
    height: 40px;
  }

  .astryx-top-bar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 0 var(--astryx-space-3, 12px);
    margin: 0 auto;
    box-sizing: border-box;
    gap: var(--astryx-space-2, 8px);
  }

  @media (min-width: 768px) {
    .astryx-top-bar-inner {
      padding: 0 var(--astryx-space-5, 20px);
    }
  }

  .astryx-top-bar-start,
  .astryx-top-bar-end {
    display: flex;
    align-items: center;
    gap: var(--astryx-space-1, 4px);
    flex-shrink: 0;
    min-width: 0;
  }

  .astryx-top-bar-center {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 0;
    height: 100%;
  }

  .astryx-top-bar-center:not(.has-start):not(.has-end) {
    justify-content: flex-start;
  }
</style>
