<script lang="ts">
  import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import { pxScreen, translateXHeaderFa, opacityHeaderIcon, pHeaderFa } from '$lib/css-classes';

  export let leavePageLink: string;
</script>

<div class="relative h-12 bg-gray-700 text-white xl:h-10">
  <div class="flex h-full justify-end {pxScreen}">
    <div class="flex transform-gpu {translateXHeaderFa}">
      <a href={leavePageLink}>
        <span
          class="flex h-full items-center text-xl xl:text-lg {pHeaderFa} {opacityHeaderIcon} cursor-pointer"
        >
          <Fa icon={faSignOutAlt} />
        </span>
      </a>
    </div>
  </div>
</div>
