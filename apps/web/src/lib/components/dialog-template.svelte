<script lang="ts">
  // Typed so importers get a declaration (svelte-check), no props.
</script>

<section
  class="mdc-elevation--z24 rounded-[calc(1rem*var(--app-radius-scale))] bg-[color:var(--surface-strong-color)] p-6 text-[color:var(--font-color)]"
>
  <h2 class="weight-medium mb-5 text-xl"><slot name="header" /></h2>
  <slot name="content" />
  <footer class="flex flex-wrap items-center justify-end pt-5">
    <slot name="footer" />
  </footer>
</section>
