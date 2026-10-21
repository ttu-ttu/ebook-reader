<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { pagePath } from '$lib/data/env';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  // Dokusho: o app abre na tela Início (ESCOPO "Interface"); o ttu abria o último livro.
  onMount(() => goto(`${pagePath}/inicio`, { replaceState: true }));
</script>

<svelte:head>
  <title>{formatPageTitle('Home')}</title>
</svelte:head>
