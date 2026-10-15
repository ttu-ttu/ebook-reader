<script lang="ts">
  import { browser } from '$app/environment';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { domainHintSeen$ } from '$lib/data/store';
  import { isOnOldUrl } from '$lib/functions/utils';

  $: if (browser && isOnOldUrl(window) && !$domainHintSeen$) {
    $domainHintSeen$ = true;
    dialogManager.dialogs$.next([
      {
        component: MessageDialog,
        props: {
          title: 'Old Domain',
          message:
            'You are currently using the old domain of ッツ Reader - consider switching to https://reader.ttsu.app to prevent issues and to ensure full features'
        },
        disableCloseOnClick: true
      }
    ]);
  }
</script>
