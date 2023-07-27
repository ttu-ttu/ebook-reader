<script lang="ts">
  import type { CustomThemeValue, ThemeOption } from '$lib/data/theme-option';
  import { createEventDispatcher } from 'svelte';

  export let label: string;
  export let attribute: keyof ThemeOption;
  export let values: CustomThemeValue;

  const dispatch = createEventDispatcher<{
    color: { attribute: keyof ThemeOption; value: string };
    alpha: { attribute: keyof ThemeOption; value: number };
  }>();

  function handleColorChange(event: Event) {
    const target = event.target as HTMLInputElement;

    dispatch('color', { attribute, value: target.value });
  }

  function handleAlphaChange(event: Event) {
    const target = event.target as HTMLInputElement;

    let value = target.value ? parseFloat(target.value) : undefined;

    if (value === undefined || value < 0 || value > 1) {
      value = 1;
      target.value = '1';
    }

    dispatch('alpha', { attribute, value });
  }
</script>

<span>{label}</span>
<input
  type="color"
  class="border border-black"
  value={values.hexExpression}
  on:change={handleColorChange}
/>
<input
  type="number"
  step="0.1"
  min="0"
  max="1"
  value={values.alphaValue}
  on:change={handleAlphaChange}
/>
