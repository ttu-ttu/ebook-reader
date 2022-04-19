<script lang="ts">
  export let title: string;
  export let marginBottom = true;
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class="block">
  <span class="text-lg">{title}</span>
  <slot />
</label>
{#if marginBottom}
  <div class="mb-4" />
{/if}
