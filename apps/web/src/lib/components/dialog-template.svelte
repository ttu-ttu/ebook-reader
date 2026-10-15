<section class=" mdc-elevation--z24 rounded bg-white p-6">
  <h2 class="weight-medium mb-5 text-xl"><slot name="header" /></h2>
  <slot name="content" />
  <footer class="flex flex-wrap items-center justify-end pt-5">
    <slot name="footer" />
  </footer>
</section>
