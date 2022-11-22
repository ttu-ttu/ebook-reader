<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { database } from '$lib/data/store';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { observe } from '$lib/functions/rxjs/use-observable';
  import { map, tap } from 'rxjs';

  const autoNavigate$ = database.lastItem$.pipe(
    map((lastItem) => (lastItem ? `${base}/b?id=${lastItem.dataId}` : 'manage')),
    tap(goto)
  );
</script>

<svelte:head>
  <title>{formatPageTitle('Home')}</title>
</svelte:head>

<div use:observe={autoNavigate$} />
