<script lang="ts">
  import { faArrowDown19 } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Popover from '../popover/popover.svelte';
  import SettingsDimensionContent from './settings-dimension-content.svelte';

  export let isFirstDimension = false;
  export let isVertical = false;
  export let dimensionValue = 0;
</script>

<Popover>
  <Fa icon={faArrowDown19} slot="icon" class="mx-2" />
  <SettingsDimensionContent slot="content" {isFirstDimension} {isVertical} bind:dimensionValue />
</Popover>
