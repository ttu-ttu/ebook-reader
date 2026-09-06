<script lang="ts">
  import { goto } from '$app/navigation';
  import { pagePath } from '$lib/data/env';
  import { database } from '$lib/data/store';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { observe } from '$lib/functions/rxjs/use-observable';
  import { catchError, map, of, tap } from 'rxjs';
  import { onMount } from 'svelte';

  const targetManage = `${pagePath}/manage`;

  const autoNavigate$ = database.lastItem$.pipe(
    map((lastItem) => (lastItem ? `${pagePath}/b?id=${lastItem.dataId}` : targetManage)),
    catchError((err) => {
      console.error('Error loading last item, navigating to manage:', err);
      return of(targetManage);
    }),
    tap((target) => {
      goto(target);
    })
  );

  onMount(() => {
    // Safety fallback: if autoNavigate$ does not trigger within 1.5s, navigate to manage
    const timer = setTimeout(() => {
      goto(targetManage);
    }, 1500);

    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>{formatPageTitle('Home')}</title>
</svelte:head>

<div
  use:observe={autoNavigate$}
  class="flex h-screen w-screen items-center justify-center text-sm opacity-60"
>
  Loading...
</div>
