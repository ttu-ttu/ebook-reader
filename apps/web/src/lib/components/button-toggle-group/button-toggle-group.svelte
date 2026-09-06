<script lang="ts">
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import { ToggleButtonGroup } from '@custom-ereader/ui';

  export let options: ToggleOption<any>[];
  export let selectedOptionId: any;
  export let invertColors: boolean = false;
</script>

<ToggleButtonGroup
  {options}
  bind:selectedOptionId
  {invertColors}
  on:edit
  on:delete
  on:change
  {...$$restProps}
>
  <slot />
</ToggleButtonGroup>
