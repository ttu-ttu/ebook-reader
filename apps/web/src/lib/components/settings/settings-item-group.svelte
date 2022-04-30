<script type="ts">
  export let title: string;
  export let asGrid = false;
  export let columns = 3;

  $: containerClasses = asGrid ? `grid md:grid-cols-${columns} gap-x-8` : '';
</script>

<section class="pb-8">
  <h2 class="mb-2 text-xl font-medium capitalize">
    {title}
  </h2>
  <div class={containerClasses}>
    <slot />
  </div>
</section>
