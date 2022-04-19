<script context="module" lang="ts">
  import type { ErrorLoad } from '@sveltejs/kit';

  export const load: ErrorLoad = () => ({
    status: 302,
    redirect: '/manage'
  });
</script>
