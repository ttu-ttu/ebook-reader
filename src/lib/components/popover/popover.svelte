<script lang="ts">
  import { browser } from '$app/environment';
  import { popovers } from '$lib/components/popover/popover';
  import { CLOSE_POPOVER } from '$lib/data/events';
  import { clickOutside } from '$lib/functions/use-click-outside';
  import type { Instance, Placement } from '@popperjs/core';
  import flip from '@popperjs/core/lib/modifiers/flip';
  import offset from '@popperjs/core/lib/modifiers/offset';
  import { createPopper } from '@popperjs/core/lib/popper-lite';
  import { createEventDispatcher, tick } from 'svelte';

  export let contentText = '';
  export let containerStyles = '';
  export let innerContainerStyles = '';
  export let contentStyles = 'padding: 0';
  export let eventType = 'click';
  export let fallbackPlacements = ['left', 'bottom', 'right'];
  export let placement: Placement = 'top';
  export let singlePopover = true;
  export let xOffset = 0;
  export let yOffset = 10;

  const dispatch = createEventDispatcher<{
    open: void;
  }>();

  let contentElement: HTMLElement;
  let iconElement: HTMLElement;
  let popoverElement: HTMLElement;

  let id: symbol;
  let instance: Instance;
  let isOpen = false;

  $: if (browser) {
    id = Symbol('popover');
  }
  $: if (isOpen && singlePopover && !$popovers.includes(id)) {
    isOpen = false;
  }

  export async function toggleOpen(referenceElement?: HTMLElement | Event) {
    if (isOpen) {
      popovers.remove(id);
    } else if (singlePopover) {
      popovers.replace(id);
    } else {
      popovers.add(id);
    }

    isOpen = !isOpen;
    await tick();

    if (isOpen && instance) {
      instance.state.elements.reference = getTargetElement(referenceElement);
      instance.state.elements.popper = popoverElement;
      await instance.update().catch(() => {
        // no-op
      });
      await tick();
      dispatch('open');
    } else if (isOpen) {
      instance = createPopper(getTargetElement(referenceElement), popoverElement, {
        placement,
        modifiers: [
          flip,
          {
            name: 'flip',
            options: {
              fallbackPlacements
            }
          },
          offset,
          {
            name: 'offset',
            options: {
              offset: [xOffset, yOffset]
            }
          }
        ]
      });

      await tick();
      dispatch('open');
    }
  }

  function conditionalClickHandlerAndClass(node: HTMLElement, conditionFulfilled: boolean) {
    if (conditionFulfilled) {
      node.classList.add('cursor-pointer');
      if (eventType === 'click') {
        node.addEventListener('click', toggleOpen, false);
      } else {
        node.addEventListener('pointerenter', toggleOpen, false);
        node.addEventListener('pointerleave', toggleOpen, false);
      }
    } else {
      node.classList.remove('cursor-pointer');
      if (eventType === 'click') {
        node.removeEventListener('click', toggleOpen, false);
      } else {
        node.removeEventListener('pointerenter', toggleOpen, false);
        node.removeEventListener('pointerleave', toggleOpen, false);
      }
    }

    return {
      destroy() {
        if (eventType === 'click') {
          node.removeEventListener('click', toggleOpen, false);
        } else {
          node.removeEventListener('pointerenter', toggleOpen, false);
          node.removeEventListener('pointerleave', toggleOpen, false);
        }
      }
    };
  }

  function externalClose(node: HTMLElement) {
    node.addEventListener(CLOSE_POPOVER, toggleOpen, false);

    return {
      destroy() {
        node.removeEventListener(CLOSE_POPOVER, toggleOpen, false);
      }
    };
  }

  function getTargetElement(referenceElement?: HTMLElement | Event) {
    let targetElement;

    if (referenceElement instanceof HTMLElement) {
      targetElement = referenceElement;
    } else {
      targetElement = $$slots.icon ? iconElement : contentElement;
    }

    return targetElement;
  }
</script>

<div data-popover class="flex items-center" style={containerStyles}>
  <div
    style={innerContainerStyles}
    use:conditionalClickHandlerAndClass={!$$slots.icon}
    bind:this={contentElement}
  >
    <slot />
  </div>
  <div use:conditionalClickHandlerAndClass={$$slots.icon} bind:this={iconElement}>
    <slot name="icon" />
  </div>
</div>

{#if isOpen}
  <div
    data-popover
    class="max-w-60vw absolute z-10 rounded bg-[#333] text-sm font-bold text-white md:max-w-lg"
    class:whitespace-pre-wrap={contentText}
    bind:this={popoverElement}
  >
    <div
      style={contentStyles}
      use:externalClose
      use:clickOutside={({ target }) => {
        if (!(target instanceof Element && target.closest('[data-popover]'))) {
          toggleOpen();
        }
      }}
    >
      {contentText}
      <slot name="content" />
    </div>
  </div>
{/if}
