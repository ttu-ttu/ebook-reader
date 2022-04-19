<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  export let styleSheet: string;

  let styleEl: HTMLStyleElement | undefined;

  $: {
    if (styleEl) {
      updateSheet(styleEl, styleSheet);
    }
  }

  function updateSheet(el: HTMLStyleElement, sheet: string) {
    const styleNode = document.createTextNode(sheet);
    if (el.firstChild) {
      el.replaceChild(styleNode, el.firstChild);
      return;
    }
    el.appendChild(styleNode);
  }

  onMount(() => {
    styleEl = document.createElement('style');
    document.head.appendChild(styleEl);
  });

  onDestroy(() => {
    if (styleEl) {
      document.head.removeChild(styleEl);
    }
  });
</script>
