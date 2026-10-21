<script lang="ts">
  import { PUBLIC_SUPABASE_URL } from '$env/static/public';
  import { estadoSinc$, sincronizarAgora } from '$lib/data/supabase/sincronizacao/iniciar';
  import { painelDoSupabase } from '$lib/data/supabase/sincronizacao/regras';

  // "Servidor pausado; reative no painel do Supabase" (ESCOPO "Riscos"): o plano gratuito pausa o
  // projeto depois de uma semana sem uso. O app segue offline com o que está no aparelho.
</script>

{#if $estadoSinc$.tipo === 'sem-servidor'}
  <div class="dokusho-aviso-servidor" role="status">
    <span>
      Servidor pausado ou fora do ar: o app segue com o que está neste aparelho.
      <a href={painelDoSupabase(PUBLIC_SUPABASE_URL)} target="_blank" rel="noreferrer"
        >Reative no painel do Supabase</a
      > e depois toque em "Tentar".
    </span>
    <button on:click={sincronizarAgora}>Tentar</button>
  </div>
{/if}

<style lang="scss">
  .dokusho-aviso-servidor {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--dk-warn-soft);
    color: var(--dk-ink);
    font-size: 14px;
    box-shadow: 0 4px 16px var(--dk-shadow);

    a {
      color: var(--dk-accent);
      font-weight: 700;
      text-decoration: underline;
    }

    button {
      flex: none;
      font-weight: 700;
      color: var(--dk-warn);
    }
  }
</style>
