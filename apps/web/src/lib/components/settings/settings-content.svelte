<script lang="ts">
  import ButtonToggleGroup from '$lib/components/button-toggle-group/button-toggle-group.svelte';
  import type { ToggleOption } from '$lib/components/button-toggle-group/toggle-option';
  import SettingsDimensionPopover from '$lib/components/settings/settings-dimension-popover.svelte';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import SettingsStorageSourceList from '$lib/components/settings/settings-storage-source-list.svelte';
  import { inputClasses } from '$lib/css-classes';
  import { logger } from '$lib/data/logger';
  import { isAppDefault } from '$lib/data/storage/storage-source-manager';
  import { defaultStorageSources } from '$lib/data/storage/storage-types';
  import { isStorageSourceAvailable } from '$lib/data/storage/storage-view';
  import { database } from '$lib/data/store';
  import { availableThemes as availableThemesMap } from '$lib/data/theme-option';
  import { FuriganaStyle } from '$lib/data/furigana-style';
  import { ViewMode } from '$lib/data/view-mode';
  import type { WritingMode } from '$lib/data/writing-mode';
  import {
    ReplicationSaveBehavior,
    AutoReplicationType
  } from '$lib/functions/replication/replication-options';
  import { map } from 'rxjs';

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

  export let avoidPageBreak: boolean;

  export let pageColumns: number;

  export let persistentStorage: boolean;

  export let autoBookmark: boolean;

  export let activeSettings: string;

  export let confirmClose: boolean;

  export let cacheStorageData: boolean;

  export let autoReplication: string;

  export let replicationSaveBehavior: string;

  export let showExternalPlaceholder: boolean;

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

  const optionsForAutoReplicationType: ToggleOption<AutoReplicationType>[] = [
    {
      id: AutoReplicationType.Off,
      text: 'Off'
    },
    {
      id: AutoReplicationType.Up,
      text: 'Up'
    },
    {
      id: AutoReplicationType.Down,
      text: 'Down'
    },
    {
      id: AutoReplicationType.All,
      text: 'All'
    }
  ];

  const optionsForReplicationSaveBehavior: ToggleOption<ReplicationSaveBehavior>[] = [
    {
      id: ReplicationSaveBehavior.NewOnly,
      text: 'New Only'
    },
    {
      id: ReplicationSaveBehavior.Overwrite,
      text: 'Overwrite'
    }
  ];

  const storageSources$ = database.storageSourcesChanged$.pipe(
    map((storageSources) => [
      ...defaultStorageSources
        .filter((defaultStorageSource) =>
          isStorageSourceAvailable(defaultStorageSource.type, defaultStorageSource.name, window)
        )
        .map((defaultStorageSource) => ({
          name: defaultStorageSource.name,
          type: defaultStorageSource.type,
          data: new ArrayBuffer(0),
          lastSourceModified: 0
        })),
      ...storageSources.filter((storageSource) => !isAppDefault(storageSource.name))
    ])
  );

  let furiganaStyleTooltip = '';
  let autoReplicationTypeTooltip = '';

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
    ? 'Reader uses higher storage limit for local data'
    : 'Uses lower temporary storage for local data.\nMay require bookmark or notification permissions for enablement';
  $: cacheStorageDataTooltip = cacheStorageData
    ? 'Storage data is cached. Saves network traffic/latency but requires to reload current/open a new tab to retrieve data changes'
    : 'Storage data is refetched on every action. May consume more network traffic/latency but ensures current data';
  $: replicationSaveBehaviorTooltip =
    replicationSaveBehavior === ReplicationSaveBehavior.Overwrite
      ? 'Data will always be overwritten'
      : 'Data will only be written if none exist on target, no time data is present or if target data is older';
  $: switch (autoReplication) {
    case AutoReplicationType.Up:
      autoReplicationTypeTooltip =
        'Updated data will be exported to sync target when reading once per minute';
      break;
    case AutoReplicationType.Down:
      autoReplicationTypeTooltip = 'Data will be imported from sync target when opening a book';
      break;
    case AutoReplicationType.All:
      autoReplicationTypeTooltip = 'Data will be synced in both directions';
      break;
    default:
      autoReplicationTypeTooltip = 'No automatic import/export of data';
      break;
  }
  $: showExternalPlaceholderToolTip = showExternalPlaceholder
    ? 'Placeholder data for external books is shown in the browser source manager'
    : 'Placeholder data for external books is hidden';

  $: if (activeSettings === 'Data' && !$storageSources$) {
    database
      .getStorageSources()
      .then((storageSources) => {
        database.storageSourcesChanged$.next(storageSources);
      })
      .catch((error) => {
        logger.error(`Failed to retrieve storage sources: ${error.message}`);
        database.storageSourcesChanged$.next([]);
      });
  }
</script>

<div class="grid grid-cols-1 items-center sm:grid-cols-2 sm:gap-6 lg:md:gap-8 lg:grid-cols-3">
  {#if activeSettings === 'Reader'}
    <div class="sm:col-span-2 lg:col-span-3">
      <SettingsItemGroup title="Theme">
        <ButtonToggleGroup options={optionsForTheme} bind:selectedOptionId={selectedTheme} />
      </SettingsItemGroup>
    </div>
    <SettingsItemGroup title="Font size">
      <input type="number" class={inputClasses} step="1" min="1" bind:value={fontSize} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Font family (Group 1)">
      <input
        type="text"
        class={inputClasses}
        placeholder="Noto Serif JP"
        bind:value={fontFamilyGroupOne}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Font family (Group 2)">
      <input
        type="text"
        class={inputClasses}
        placeholder="Noto Sans JP"
        bind:value={fontFamilyGroupTwo}
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
    <SettingsItemGroup
      title="Close Confirmation"
      tooltip={`When enabled asks for confirmation on closing/reloading a reader tab and unsaved changes were detected`}
    >
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={confirmClose} />
    </SettingsItemGroup>
    {#if viewMode === ViewMode.Continuous}
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
    <SettingsItemGroup title="Cache Data" tooltip={cacheStorageDataTooltip}>
      <ButtonToggleGroup options={optionsForToggle} bind:selectedOptionId={cacheStorageData} />
    </SettingsItemGroup>
    <SettingsItemGroup title="Auto Import/Export" tooltip={autoReplicationTypeTooltip}>
      <ButtonToggleGroup
        options={optionsForAutoReplicationType}
        bind:selectedOptionId={autoReplication}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Import/Export Behavior" tooltip={replicationSaveBehaviorTooltip}>
      <ButtonToggleGroup
        options={optionsForReplicationSaveBehavior}
        bind:selectedOptionId={replicationSaveBehavior}
      />
    </SettingsItemGroup>
    <SettingsItemGroup title="Show Placeholder" tooltip={showExternalPlaceholderToolTip}>
      <ButtonToggleGroup
        options={optionsForToggle}
        bind:selectedOptionId={showExternalPlaceholder}
      />
    </SettingsItemGroup>
    <SettingsStorageSourceList storageSources={$storageSources$} />
  {/if}
</div>
