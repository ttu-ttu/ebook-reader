<script lang="ts">
  import { map, tap } from 'rxjs';
  import { goto } from '$app/navigation';
  import { database } from '$lib/data/store';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { observe } from '$lib/functions/rxjs/use-observable';

  const autoNavigate$ = database.lastItem$.pipe(
    map((lastItem) => (lastItem ? `/b/${lastItem.dataId}` : 'manage')),
    tap(goto)
  );
</script>

<svelte:head>
  <title>{formatPageTitle('Home')}</title>
</svelte:head>

<div use:observe={autoNavigate$} />
