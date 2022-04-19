<script type="ts">
  export let title: string;
</script>

<section class="pb-8">
  <h2 class="mb-2 text-xl font-medium capitalize">
    {title}
  </h2>
  <slot />
</section>
