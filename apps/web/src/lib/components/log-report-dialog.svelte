<script lang="ts">
  import { buttonClasses } from '$lib/css-classes';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { logger } from '$lib/data/logger';

  export let title = 'Error';

  export let message: string;

  const encodedLog = encodeURIComponent(
    JSON.stringify(
      {
        userAgent: navigator.userAgent,
        log: logger.history
      },
      null,
      2
    )
  );
  const downloadableLog = `data:text/json;charset=utf-8,${encodedLog}`;
</script>

<DialogTemplate>
  <svelte:fragment slot="header">{title}</svelte:fragment>
  <svelte:fragment slot="content">
    <p>{message}</p>
  </svelte:fragment>
  <svelte:fragment slot="footer">
    <a class={buttonClasses} href={downloadableLog} download="log.json">
      Download Report
      <Ripple />
    </a>
  </svelte:fragment>
</DialogTemplate>
