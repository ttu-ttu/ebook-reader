<script lang="ts">
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import { baseHeaderClasses, pxScreen } from '$lib/css-classes';

  export let leavePageLink: string;
</script>

<div class={baseHeaderClasses}>
  <div class="flex grow items-center justify-end {pxScreen} px-0 md:px-5">
    <MergedHeaderIcon {leavePageLink} />
  </div>
</div>
