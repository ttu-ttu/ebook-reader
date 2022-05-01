<script lang="ts">
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import { inputClasses } from '$lib/css-classes';
  import FormField from '$lib/components/form-field/form-field.svelte';
  import { availableThemes as availableThemesMap } from '$lib/data/theme-option';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import { ViewMode } from '$lib/data/view-mode';
  import type { WritingMode } from '$lib/data/writing-mode';
  import SettingsItemGroup from './settings-item-group.svelte';

  export let selectedTheme: string;

  export let fontSize: number;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let blurImage: boolean;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let writingMode: WritingMode;

  export let viewMode: ViewMode;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let autoPositionOnResize: boolean;

  export let persistentStorage: boolean;

  const availableThemes = Array.from(availableThemesMap.entries()).map(([theme, option]) => ({
    theme,
    option
  }));

  const optionsForTheme: ToggleOption<string>[] = availableThemes.map(({ theme, option }) => ({
    id: theme,
    text: 'ぁあ',
    style: {
      color: option.fontColor,
      'background-color': option.backgroundColor
    }
  }));

  const optionsForToggle: ToggleOption<boolean>[] = [
    {
      id: false,
      text: 'Off'
    },
    {
      id: true,
      text: 'On'
    }
  ];

  const optionsForFuriganaStyle: ToggleOption<FuriganaStyle>[] = [
    {
      id: FuriganaStyle.Partial,
      text: 'Partial'
    },
    {
      id: FuriganaStyle.Full,
      text: 'Full'
    },
    {
      id: FuriganaStyle.Toggle,
      text: 'Toggle'
    }
  ];

  const optionsForWritingMode: ToggleOption<WritingMode>[] = [
    {
      id: 'horizontal-tb',
      text: 'Horizontal'
    },
    {
      id: 'vertical-rl',
      text: 'Vertical'
    }
  ];

  const optionsForViewMode: ToggleOption<ViewMode>[] = [
    {
      id: ViewMode.Continuous,
      text: 'Continuous'
    },
    {
      id: ViewMode.Paginated,
      text: 'Paginated'
    }
  ];

  $: verticalMode = writingMode === 'vertical-rl';
</script>

<SettingsItemGroup title="Theme">
  <ButtonToggleGroup options={optionsForTheme} bind:selectedOptionId={selectedTheme} />
</SettingsItemGroup>

<SettingsItemGroup title="Font settings" asGrid>
  <FormField title="Font size">
    <input type="number" class={inputClasses} step="1" min="1" bind:value={fontSize} />
  </FormField>
  <FormField title="Font family (Group 1)">
    <input
      type="text"
      class={inputClasses}
      placeholder="Noto Serif JP"
      bind:value={fontFamilyGroupOne}
    />
  </FormField>
  <FormField title="Font family (Group 2)" marginBottom={false}>
    <input
      type="text"
      class={inputClasses}
      placeholder="Noto Sans JP"
      bind:value={fontFamilyGroupTwo}
    />
  </FormField>
</SettingsItemGroup>

<div class="grid grid-cols-1 sm:grid-cols-2 md:gap-y-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10">
  <SettingsItemGroup title="View mode">
    <ButtonToggleGroup options={optionsForViewMode} bind:selectedOptionId={viewMode} />
  </SettingsItemGroup>
  <SettingsItemGroup title="Writing mode">
    <ButtonToggleGroup options={optionsForWritingMode} bind:selectedOptionId={writingMode} />
  </SettingsItemGroup>
  <SettingsItemGroup title="Blur image">
    <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={blurImage} />
  </SettingsItemGroup>
  <SettingsItemGroup title="Hide furigana">
    <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={hideFurigana} />
  </SettingsItemGroup>
  <SettingsItemGroup title="Hide furigana style">
    <ButtonToggleGroup options={optionsForFuriganaStyle} bind:selectedOptionId={furiganaStyle} />
  </SettingsItemGroup>
  <SettingsItemGroup title="Persistent storage">
    <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={persistentStorage} />
  </SettingsItemGroup>
  {#if viewMode === ViewMode.Continuous}
    <SettingsItemGroup title="Auto position on resize">
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={autoPositionOnResize} />
    </SettingsItemGroup>
    <div class="lg:col-span-2">
      <SettingsItemGroup title="Reader size" asGrid columns={2}>
        <FormField title={verticalMode ? 'Max height' : 'Max width'}>
          <input
            type="number"
            class={inputClasses}
            step="1"
            min="0"
            bind:value={secondDimensionMaxValue}
          />
        </FormField>

        <FormField
          title={verticalMode ? 'Left/right margin' : 'Top/bottom margin'}
          marginBottom={false}
        >
          <input
            type="number"
            class={inputClasses}
            step="1"
            min="0"
            bind:value={firstDimensionMargin}
          />
        </FormField>
      </SettingsItemGroup>
    </div>
  {/if}
</div>
