<script>
  import flip from '@popperjs/core/lib/modifiers/flip';
  import offset from '@popperjs/core/lib/modifiers/offset';
  import { createPopper } from '@popperjs/core/lib/popper-lite';
  import { popovers } from '$lib/data/store';
  import { browser } from '$app/env';
  import { generateUUID } from '../functions/util';

  export let content = '';
  export let singlePopover = true;

  let contentElement;
  let iconElement;
  let popoverElement;

  let id;
  let isOpen = false;
  let instance;

  $: if (browser) {
    id = generateUUID();
  }
  $: if (isOpen && singlePopover && !$popovers.includes(id)) {
    isOpen = false;
  }

  function conditionalClickHandlerAndClass(node, conditionFulfilled) {
    if (conditionFulfilled) {
      node.classList.add('cursor-pointer');
      node.addEventListener('click', toggleOpen, false);
    } else {
      node.classList.remove('cursor-pointer');
      node.removeEventListener('click', toggleOpen, false);
    }

    return {
      destroy() {
        node.removeEventListener('click', toggleOpen, false);
      }
    };
  }

  function toggleOpen() {
    if (isOpen) {
      popovers.remove(id);
    } else if (singlePopover) {
      popovers.replace(id);
    } else {
      popovers.add(id);
    }

    isOpen = !isOpen;

    if (isOpen && instance) {
      instance.update();
    } else if (isOpen) {
      instance = createPopper($$slots.icon ? iconElement : contentElement, popoverElement, {
        placement: 'top',
        modifiers: [
          flip,
          {
            name: 'flip',
            options: {
              fallbackPlacements: ['left', 'bottom', 'right']
            }
          },
          offset,
          {
            name: 'offset',
            options: {
              offset: [0, 10]
            }
          }
        ]
      });
    }
  }
</script>

<div class="flex items-center">
  <div use:conditionalClickHandlerAndClass={!$$slots.icon} bind:this={contentElement}>
    <slot />
  </div>
  <div use:conditionalClickHandlerAndClass={$$slots.icon} bind:this={iconElement}>
    <slot name="icon" />
  </div>
</div>

<div
  class="max-w-60vw z-10 whitespace-pre-wrap rounded bg-[#333] p-2 text-sm font-bold text-white md:max-w-lg"
  class:hidden={!isOpen}
  bind:this={popoverElement}
  on:click={toggleOpen}
>
  <div>{content}</div>
</div>
