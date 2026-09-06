<script lang="ts">
  export let text: string = '';
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let disabled: boolean = false;
  let customClass: string = '';
  export { customClass as class };

  let isVisible = false;
  let timeoutId: any;

  function show() {
    if (disabled || !text) return;
    timeoutId = setTimeout(() => {
      isVisible = true;
    }, 150);
  }

  function hide() {
    clearTimeout(timeoutId);
    isVisible = false;
  }
</script>

<div
  role="group"
  class="astryx-tooltip-wrapper {customClass}"
  on:mouseenter={show}
  on:mouseleave={hide}
  on:focusin={show}
  on:focusout={hide}
  {...$$restProps}
>
  <slot />

  {#if isVisible && text}
    <div role="tooltip" class="astryx-tooltip" data-position={position}>
      {text}
      <div class="astryx-tooltip-arrow"></div>
    </div>
  {/if}
</div>

<style>
  .astryx-tooltip-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .astryx-tooltip {
    position: absolute;
    z-index: 1100;
    padding: var(--astryx-space-1, 4px) var(--astryx-space-2, 8px);
    font-family: var(--astryx-font-family-sans, sans-serif);
    font-size: var(--astryx-font-size-xs, 0.75rem);
    font-weight: var(--astryx-font-weight-medium, 500);
    line-height: 1.2;
    color: #ffffff;
    background-color: #18181b;
    border-radius: var(--astryx-radius-sm, 4px);
    box-shadow: var(--astryx-elevation-md, 0 4px 6px -1px rgba(0, 0, 0, 0.15));
    white-space: nowrap;
    pointer-events: none;
    animation: astryx-tooltip-fade 120ms ease forwards;
  }

  /* Positions */
  [data-position='top'] {
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }
  [data-position='top'] .astryx-tooltip-arrow {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid #18181b;
  }

  [data-position='bottom'] {
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
  }
  [data-position='bottom'] .astryx-tooltip-arrow {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 4px solid #18181b;
  }

  [data-position='left'] {
    right: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }
  [data-position='left'] .astryx-tooltip-arrow {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 4px solid #18181b;
  }

  [data-position='right'] {
    left: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
  }
  [data-position='right'] .astryx-tooltip-arrow {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-right: 4px solid #18181b;
  }

  .astryx-tooltip-arrow {
    position: absolute;
    width: 0;
    height: 0;
  }

  @keyframes astryx-tooltip-fade {
    from {
      opacity: 0;
      transform: scale(0.96) translate(-50%, 0);
    }
    to {
      opacity: 1;
      transform: scale(1) translate(-50%, 0);
    }
  }

  [data-position='left'] {
    animation-name: astryx-tooltip-fade-left;
  }
  [data-position='right'] {
    animation-name: astryx-tooltip-fade-right;
  }

  @keyframes astryx-tooltip-fade-left {
    from {
      opacity: 0;
      transform: scale(0.96) translate(0, -50%);
    }
    to {
      opacity: 1;
      transform: scale(1) translate(0, -50%);
    }
  }

  @keyframes astryx-tooltip-fade-right {
    from {
      opacity: 0;
      transform: scale(0.96) translate(0, -50%);
    }
    to {
      opacity: 1;
      transform: scale(1) translate(0, -50%);
    }
  }
</style>
