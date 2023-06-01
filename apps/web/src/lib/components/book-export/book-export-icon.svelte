<script lang="ts">
  export let selected: boolean;
  export let disabled: boolean;
  export let d: string;
  export let viewBox: string;
  export let label: string;
</script>

<div
  class="cursor-pointer border py-4 text-center hover:border hover:border-current"
  class:border-transparent={!selected}
  class:border-current={selected}
  class:opacity-5={disabled}
  class:cursor-not-allowed={disabled}
  class:hover:border-transparent={disabled}
  on:click
  on:keyup
>
  <svg
    class="inline-block h-8 w-8 md:h-14 md:w-14 lg:h-20 lg:w-20"
    xmlns="http://www.w3.org/2000/svg"
    {viewBox}
  >
    <path class="fill-current" {d} />
  </svg>
  <div class="mt-2">{label}</div>
</div>
