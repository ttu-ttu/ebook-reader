<script lang="ts">
  import { onMount } from 'svelte';
  import { buttonClasses } from '$lib/css-classes';
  import { diasDesde } from '$lib/data/backup/backup';
  import {
    marcarBackupFeito,
    prepararBackup,
    restaurarBackup,
    ultimoBackup
  } from '$lib/data/backup/fazer-backup';
  import { entregarArquivo } from '$lib/functions/anki/entregar-arquivo';

  // Configurações › Data › Backup (ESCOPO "Configurações"): baixar, restaurar e a idade do último.

  let ultimo: number | undefined;
  let ocupado = '';
  let pronto: { arquivo: Blob; nome: string } | undefined;
  let confirmar: File | undefined;
  let mensagem = '';

  onMount(() => (ultimo = ultimoBackup()));

  $: dias = diasDesde(ultimo, Date.now());

  async function executar(acao: () => Promise<void>) {
    mensagem = '';

    try {
      await acao();
    } catch (e) {
      mensagem = e instanceof Error ? e.message : String(e);
    } finally {
      ocupado = '';
    }
  }

  const preparar = () =>
    executar(async () => {
      ocupado = 'Preparando…';
      pronto = await prepararBackup((texto) => (ocupado = texto));
    });

  const entregar = () =>
    executar(async () => {
      if (!pronto) return;

      const resultado = await entregarArquivo(pronto.arquivo, pronto.nome);

      if (resultado === 'cancelado') return;

      marcarBackupFeito();
      ultimo = ultimoBackup();
      pronto = undefined;
      mensagem = 'Backup salvo.';
    });

  const restaurar = () =>
    executar(async () => {
      if (!confirmar) return;

      const arquivo = confirmar;

      confirmar = undefined;
      ocupado = 'Restaurando…';

      const total = await restaurarBackup(arquivo, (texto) => (ocupado = texto));

      mensagem = `Restaurado: ${total.toLocaleString('pt-BR')} linhas.`;
    });
</script>

<div class="flex flex-col gap-2">
  <p>
    {#if dias === undefined}
      Último backup: nunca neste aparelho.
    {:else if dias === 0}
      Último backup: hoje.
    {:else}
      Último backup: há {dias}
      {dias === 1 ? 'dia' : 'dias'}.
    {/if}
  </p>

  <div class="flex flex-wrap gap-4">
    {#if pronto}
      <button class={buttonClasses} on:click={entregar}>Salvar o backup</button>
      <button class={buttonClasses} on:click={() => (pronto = undefined)}>Cancelar</button>
    {:else}
      <button class={buttonClasses} disabled={!!ocupado} on:click={preparar}>Baixar backup</button>
    {/if}
    <label class={buttonClasses}>
      Restaurar backup
      <input
        type="file"
        accept=".zip,application/zip"
        hidden
        disabled={!!ocupado}
        on:change={(e) => {
          confirmar = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
        }}
      />
    </label>
  </div>

  {#if confirmar}
    <div class="rounded bg-yellow-100 p-3 text-sm text-gray-800">
      Restaurar {confirmar.name}? As linhas do backup voltam para a sua conta; o que estiver mais
      novo no servidor (pelo horário de cada mudança) fica como está. Nada é apagado.
      <div class="mt-2 flex gap-4">
        <button class={buttonClasses} on:click={restaurar}>Restaurar</button>
        <button class={buttonClasses} on:click={() => (confirmar = undefined)}>Cancelar</button>
      </div>
    </div>
  {/if}

  {#if ocupado}
    <p class="text-sm opacity-60">{ocupado}</p>
  {/if}
  {#if mensagem}
    <p class="text-sm">{mensagem}</p>
  {/if}
</div>
