<script context="module" lang="ts">
  import type { Load } from '@sveltejs/kit';
  import { toSearchParams } from '$lib/functions/to-search-params';

  export const load: Load = ({ params }) => ({
    status: 302,
    redirect: `/b?${toSearchParams(params)}`
  });
</script>
