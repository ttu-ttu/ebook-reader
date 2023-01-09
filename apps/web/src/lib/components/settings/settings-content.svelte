<script lang="ts">
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import SettingsDimensionPopover from '$lib/components/settings/settings-dimension-popover.svelte';
  import SettingsFontSelector from '$lib/components/settings/settings-font-selector.svelte';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import { inputClasses } from '$lib/css-classes';
  import { LocalFont } from '$lib/data/fonts';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import {
    horizontalCustomReadingPosition$,
    verticalCustomReadingPosition$
  } from '$lib/data/store';
  import { availableThemes as availableThemesMap } from '$lib/data/theme-option';
  import { ViewMode } from '$lib/data/view-mode';
  import type { WritingMode } from '$lib/data/writing-mode';
  import { dummyFn } from '$lib/functions/utils';

  export let selectedTheme: string;

  export let fontFamilyGroupOne: string;

  export let fontFamilyGroupTwo: string;

  export let fontSize: number;

  export let lineHeight: number;

  export let blurImage: boolean;

  export let hideFurigana: boolean;

  export let furiganaStyle: FuriganaStyle;

  export let writingMode: WritingMode;

  export let viewMode: ViewMode;

  export let secondDimensionMaxValue: number;

  export let firstDimensionMargin: number;

  export let autoPositionOnResize: boolean;

  export let avoidPageBreak: boolean;

  export let customReadingPointEnabled: boolean;

  export let selectionToBookmarkEnabled: boolean;

  export let pageColumns: number;

  export let persistentStorage: boolean;

  export let autoBookmark: boolean;

  export let activeSettings: string;

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
    },
    thickBorders: true
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

  let furiganaStyleTooltip = '';

  $: verticalMode = writingMode === 'vertical-rl';
  $: switch (furiganaStyle) {
    case FuriganaStyle.Full:
      furiganaStyleTooltip = 'Hidden by default, show on hover or click';
      break;
    case FuriganaStyle.Toggle:
      furiganaStyleTooltip = 'Hidden by default, can be toggled on click';
      break;
    default:
      furiganaStyleTooltip = 'Display furigana as grayed out text';
      break;
  }
  $: avoidPageBreakTooltip = avoidPageBreak
    ? 'Avoids breaking words/sentences into different pages'
    : 'Allow words/sentences to break into different pages';
  $: persistentStorageTooltip = persistentStorage
    ? 'Reader uses higher storage limit'
    : 'Uses lower temporary storage.\nMay require bookmark or notification permissions for enablement';
</script>

<div class="grid grid-cols-1 items-center sm:grid-cols-2 sm:gap-6 lg:md:gap-8 lg:grid-cols-3">
  {#if activeSettings === 'Reader'}
    <div class="sm:col-span-2 lg:col-span-3">
      <SettingsItemGroup title="Theme">
        <ButtonToggleGroup options={optionsForTheme} bind:selectedOptionId={selectedTheme} />
      </SettingsItemGroup>
    </div>
    <SettingsItemGroup title="Font family (Group 1)">
      <SettingsFontSelector
        slot="header"
        availableFonts={[
          LocalFont.NOTOSERIFJP,
          LocalFont.GENREI,
          LocalFont.KLEEONE,
          LocalFont.SHIPPORIMINCHO
        ]}
        bind:fontValue={fontFamilyGroupOne}
      />
      <input
        type="text"
        class={inputClasses}
        placeholder="Noto Serif JP"
        bind:value={fontFamilyGroupOne}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Font family (Group 2)">
      <SettingsFontSelector slot="header" bind:fontValue={fontFamilyGroupTwo} />
      <input
        type="text"
        class={inputClasses}
        placeholder="Noto Sans JP"
        bind:value={fontFamilyGroupTwo}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Font size">
      <input type="number" class={inputClasses} step="1" min="1" bind:value={fontSize} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Line Height">
      <input
        type="number"
        class={inputClasses}
        step="0.05"
        min="1"
        bind:value={lineHeight}
        on:change={() => {
          if (!lineHeight || lineHeight < 1) {
            lineHeight = 1.65;
          }
        }}
      />
    </SettingsItemGroup>
    <SettingsItemGroup
      title={verticalMode ? 'Reader Left/right margin' : 'Reader Top/bottom margin'}
    >
      <SettingsDimensionPopover
        slot="header"
        isFirstDimension
        isVertical={verticalMode}
        bind:dimensionValue={firstDimensionMargin}
      />
      <input
        type="number"
        class={inputClasses}
        step="1"
        min="0"
        bind:value={firstDimensionMargin}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title={verticalMode ? 'Reader Max height' : 'Reader Max width'}>
      <SettingsDimensionPopover
        slot="header"
        isVertical={verticalMode}
        bind:dimensionValue={secondDimensionMaxValue}
      />
      <input
        type="number"
        class={inputClasses}
        step="1"
        min="0"
        bind:value={secondDimensionMaxValue}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="View mode">
      <ButtonToggleGroup options={optionsForViewMode} bind:selectedOptionId={viewMode} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Writing mode">
      <ButtonToggleGroup options={optionsForWritingMode} bind:selectedOptionId={writingMode} />
    </SettingsItemGroup>
    <SettingsItemGroup
      title="Auto Bookmark"
      tooltip={'Set a bookmark after 3 seconds without scrolling/page change'}
    >
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={autoBookmark} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Blur image">
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={blurImage} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Hide furigana">
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={hideFurigana} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Hide furigana style" tooltip={furiganaStyleTooltip}>
      <ButtonToggleGroup options={optionsForFuriganaStyle} bind:selectedOptionId={furiganaStyle} />
    </SettingsItemGroup>
    {#if viewMode === ViewMode.Continuous}
      <SettingsItemGroup
        title="Custom Reading Point"
        tooltip={'Allows to set a persistent custom point in the reader from which the current progress and bookmark is calculated when enabled'}
      >
        <div class="flex items-center">
          <ButtonToggleGroup
            options={optionsForToggle}
            bind:selectedOptionId={customReadingPointEnabled}
          />
          {#if customReadingPointEnabled}
            <div
              role="button"
              class="ml-4 hover:underline"
              on:click={() => {
                verticalCustomReadingPosition$.next(100);
                horizontalCustomReadingPosition$.next(0);
              }}
              on:keyup={dummyFn}
            >
              Reset Points
            </div>
          {/if}
        </div>
      </SettingsItemGroup>
      <SettingsItemGroup title="Auto position on resize">
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={autoPositionOnResize}
        />
      </SettingsItemGroup>
    {:else}
      <SettingsItemGroup title="Avoid Page Break" tooltip={avoidPageBreakTooltip}>
        <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={avoidPageBreak} />
      </SettingsItemGroup>
      <SettingsItemGroup
        title="Selection to Bookmark"
        tooltip={'When enabled bookmarks will be placed to a near paragraph of current/previous selected text instead of page start'}
      >
        <ButtonToggleGroup
          options={optionsForToggle}
          bind:selectedOptionId={selectionToBookmarkEnabled}
        />
      </SettingsItemGroup>
      {#if !verticalMode}
        <SettingsItemGroup title="Page Columns">
          <input type="number" class={inputClasses} step="1" min="0" bind:value={pageColumns} />
        </SettingsItemGroup>
      {/if}
    {/if}
  {:else}
    <SettingsItemGroup title="Persistent storage" tooltip={persistentStorageTooltip}>
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={persistentStorage} />
    </SettingsItemGroup>
  {/if}
</div>
