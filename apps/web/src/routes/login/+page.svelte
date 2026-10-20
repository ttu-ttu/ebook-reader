<script lang="ts">
  import { onMount } from 'svelte';
  import type { Session } from '@supabase/supabase-js';
  import { buttonClasses, inputClasses, pxScreen } from '$lib/css-classes';
  import { pagePath } from '$lib/data/env';
  import { supabase } from '$lib/data/supabase/client';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  let session: Session | null = null;
  let email = '';
  let password = '';
  let errorMessage = '';
  let busy = false;

  onMount(() => {
    supabase.auth.getSession().then(({ data }) => (session = data.session));

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
    });

    return () => data.subscription.unsubscribe();
  });

  async function signIn() {
    busy = true;
    errorMessage = '';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    busy = false;
    password = '';

    if (error) {
      errorMessage = error.message;
    }
  }

  async function signOut() {
    busy = true;
    await supabase.auth.signOut();
    busy = false;
  }
</script>

<svelte:head>
  <title>{formatPageTitle('Entrar')}</title>
</svelte:head>

<div class="{pxScreen} mx-auto max-w-sm pt-16">
  <h1 class="mb-8 text-2xl">Dokusho</h1>

  {#if session}
    <p class="mb-6">Conectado como {session.user.email}</p>
    <div class="flex gap-4">
      <a class={buttonClasses} href="{pagePath}/manage">Biblioteca</a>
      <button class={buttonClasses} disabled={busy} on:click={signOut}>Sair</button>
    </div>
  {:else}
    <form on:submit|preventDefault={signIn}>
      <label class="mb-6 block">
        E-mail
        <input
          class={inputClasses}
          type="email"
          autocomplete="username"
          required
          bind:value={email}
        />
      </label>
      <label class="mb-6 block">
        Senha
        <input
          class={inputClasses}
          type="password"
          autocomplete="current-password"
          required
          bind:value={password}
        />
      </label>
      {#if errorMessage}
        <p class="mb-6 text-red-500">{errorMessage}</p>
      {/if}
      <button class={buttonClasses} type="submit" disabled={busy}>Entrar</button>
    </form>
  {/if}
</div>
