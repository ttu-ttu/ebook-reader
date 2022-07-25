<script lang="ts">
  import { faBookOpenReader, faDatabase } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import MergedHeaderIcon from '$lib/components/merged-header-icon/merged-header-icon.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { baseHeaderClasses, pxScreen } from '$lib/css-classes';

  export let leavePageLink: string;
  export let activeSettings: string;

  const settingItems = [
    {
      label: 'Reader',
      icon: faBookOpenReader
    },
    {
      label: 'Data',
      icon: faDatabase
    }
  ];
</script>

<div class={baseHeaderClasses}>
  <div class="{pxScreen} flex px-0 md:px-5">
    <div class="h12 flex grow justify-evenly xl:h-10">
      {#each settingItems as settingItem (settingItem.label)}
        <button
          class="flex grow flex-col items-center justify-center text-xs"
          class:bg-gray-900={activeSettings === settingItem.label}
          class:hover:bg-gray-900={activeSettings !== settingItem.label}
          on:click={() => (activeSettings = settingItem.label)}
        >
          <Fa class="mb-1" icon={settingItem.icon} />
          {settingItem.label}
          <Ripple />
        </button>
      {/each}
    </div>
    <MergedHeaderIcon {leavePageLink} />
  </div>
</div>
