<script lang="ts">
  export let d: string;
  export let label: string;
  export let selected: boolean;
  export let viewBox: string;
</script>

<div
  on:click
  class="mx-4 cursor-pointer border border-transparent p-10 text-center hover:border hover:border-current"
  class:border-current={selected}
>
  <svg class="inline-block h-24 w-24" xmlns="http://www.w3.org/2000/svg" {viewBox}>
    <path class="fill-current" {d} />
  </svg>
  <div class="mt-2">{label}</div>
</div>
