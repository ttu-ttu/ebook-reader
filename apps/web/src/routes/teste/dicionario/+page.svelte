<script lang="ts">
  // Página provisória do R3: baixa o dicionário do bucket `dicts`, grava no IndexedDB, carrega o
  // tokenizador e mede contra as metas (download ≤ 60 MB, preparação ≤ 1 min, consulta ≤ 100 ms).
  // Apagar no V1.2.
  import { onMount } from 'svelte';
  import { buttonClasses, inputClasses, pxScreen } from '$lib/css-classes';
  import {
    abrirDicionario,
    apagarDicionario,
    consultar,
    versaoGravada,
    type BancoDicionario
  } from '$lib/data/dicionario/banco';
  import {
    baixarArquivo,
    dicionarioEmDia,
    lerDicionarioAtual,
    prepararArquivo
  } from '$lib/data/dicionario/baixar';
  import type { Entrada } from '$lib/data/dicionario/formato';
  import {
    CACHE_TOKENIZADOR,
    carregarTokenizador,
    type Tokenizador
  } from '$lib/data/dicionario/tokenizador';
  import { supabase } from '$lib/data/supabase/client';
  import { formatPageTitle } from '$lib/functions/format-page-title';

  const AMOSTRA =
    '彼はふと気がついた。立ち止まった少女は、振り返らなかった。「わかってるよ」と言いながら、彼は笑っていた。' +
    '食べさせられたくなかったのに、何も知らずに帰ってしまった。話しかけられても返事をしなかったらしい。' +
    '読み終わったら貸してあげると約束したが、静かな夜だったので、窓の外を眺めながら考え込んでいた。';

  let db: BancoDicionario | undefined;
  let tokenizador: Tokenizador | undefined;
  let usuario = '';
  let versao = '';
  let ocupado = false;
  let progresso = '';
  let medidas: string[] = [];
  let mensagem = '';
  let termo = '気がつく';
  let resultado: Entrada[] = [];
  let texto = AMOSTRA;

  const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;
  const anotar = (linha: string) => (medidas = [...medidas, linha]);

  onMount(async () => {
    const { data } = await supabase.auth.getSession();
    usuario = data.session?.user.email ?? '';
    db = await abrirDicionario();
    versao = (await versaoGravada(db)) ?? '';
  });

  async function executar(passo: () => Promise<void>) {
    ocupado = true;
    mensagem = '';
    try {
      await passo();
    } catch (erro) {
      mensagem = `Erro: ${erro instanceof Error ? erro.message : String(erro)}`;
    } finally {
      ocupado = false;
      progresso = '';
    }
  }

  const baixar = () =>
    executar(async () => {
      if (!db) return;
      const atual = await lerDicionarioAtual(supabase);
      anotar(`No bucket: ${atual.versao}, ${mb(atual.bytes)} (${atual.entradas} entradas)`);
      if (await dicionarioEmDia(db, atual)) {
        anotar('Já está gravado nesta versão.');
        return;
      }
      let t = performance.now();
      const arquivo = await baixarArquivo(supabase, atual, (bytes, total) => {
        progresso = `Baixando ${mb(bytes)} de ${mb(total)}`;
      });
      anotar(`Download: ${mb(arquivo.size)} em ${((performance.now() - t) / 1000).toFixed(1)} s`);
      t = performance.now();
      await prepararArquivo(db, arquivo, (fracao) => {
        progresso = `Preparando ${Math.round(fracao * 100)}%`;
      });
      anotar(
        `Preparação (descompactar + IndexedDB): ${((performance.now() - t) / 1000).toFixed(1)} s`
      );
      versao = (await versaoGravada(db)) ?? '';
      const espaco = await navigator.storage?.estimate?.();
      if (espaco?.usage) anotar(`Espaço usado pelo site: ${mb(espaco.usage)}`);
    });

  // Mede só a preparação, com o arquivo de dicts/saida (sem login nem bucket).
  const prepararLocal = (evento: Event) =>
    executar(async () => {
      const arquivo = (evento.target as HTMLInputElement).files?.[0];
      if (!db || !arquivo) return;
      const t = performance.now();
      await prepararArquivo(db, arquivo, (fracao) => {
        progresso = `Preparando ${Math.round(fracao * 100)}%`;
      });
      anotar(
        `Preparação do arquivo local (${mb(arquivo.size)}): ${((performance.now() - t) / 1000).toFixed(1)} s`
      );
      versao = (await versaoGravada(db)) ?? '';
    });

  const carregar = () =>
    executar(async () => {
      const t = performance.now();
      const carregado = await carregarTokenizador();
      tokenizador = carregado.tokenizador;
      anotar(
        `Tokenizador: ${mb(carregado.bytes)} ${carregado.doCache ? 'do cache' : 'da rede'}, ` +
          `pronto em ${((performance.now() - t) / 1000).toFixed(1)} s`
      );
    });

  const buscar = () =>
    executar(async () => {
      if (!db) return;
      const t = performance.now();
      resultado = await consultar(db, termo.trim());
      anotar(
        `Consulta「${termo}」: ${resultado.length} entradas em ${(performance.now() - t).toFixed(1)} ms`
      );
    });

  const medirTexto = () =>
    executar(async () => {
      if (!db || !tokenizador) throw new Error('Baixe o dicionário e carregue o tokenizador antes');
      let t = performance.now();
      const pedacos = tokenizador.tokenizar(texto);
      anotar(`Tokenizar ${texto.length} caracteres: ${(performance.now() - t).toFixed(1)} ms`);
      const tempos: number[] = [];
      let achados = 0;
      for (const pedaco of pedacos) {
        if (pedaco.classe === '記号') continue;
        t = performance.now();
        const entradas = await consultar(db, pedaco.base);
        tempos.push(performance.now() - t);
        if (entradas.length) achados++;
      }
      tempos.sort((a, b) => a - b);
      const media = tempos.reduce((s, x) => s + x, 0) / tempos.length;
      anotar(
        `${tempos.length} consultas pela forma de dicionário: média ${media.toFixed(1)} ms, ` +
          `p95 ${tempos[Math.floor(tempos.length * 0.95)].toFixed(1)} ms, máx ${tempos.at(-1)!.toFixed(1)} ms; ` +
          `${achados} acharam entrada`
      );
    });

  const apagar = () =>
    executar(async () => {
      db?.close();
      await apagarDicionario();
      await caches.delete(CACHE_TOKENIZADOR);
      db = await abrirDicionario();
      tokenizador = undefined;
      versao = '';
      resultado = [];
      anotar('Dicionário e tokenizador apagados deste aparelho.');
    });
</script>

<svelte:head>
  <title>{formatPageTitle('Teste dicionário')}</title>
</svelte:head>

<div class="{pxScreen} mx-auto max-w-4xl pt-16 pb-16">
  <h1 class="mb-4 text-2xl">Teste dicionário e tokenizador (R3)</h1>
  <p class="mb-2 text-sm opacity-75">
    Conta: {usuario || 'não entrou'}
    {#if !usuario}(<a class="underline" href="/login">entrar</a>){/if}
  </p>
  <p class="mb-6 text-sm opacity-75">Versão gravada neste aparelho: {versao || 'nenhuma'}</p>

  <div class="mb-6 flex flex-wrap gap-2">
    <button class={buttonClasses} disabled={ocupado} on:click={baixar}>Baixar dicionário</button>
    <button class={buttonClasses} disabled={ocupado} on:click={carregar}
      >Carregar tokenizador</button
    >
    <button class={buttonClasses} disabled={ocupado} on:click={apagar}>Apagar deste aparelho</button
    >
  </div>
  <label class="mb-6 block text-sm">
    Ou preparar um arquivo local (dicts/saida/…/dicionario.ndjson.gz):
    <input type="file" accept=".gz" disabled={ocupado} on:change={prepararLocal} />
  </label>

  {#if progresso}
    <p class="mb-4">{progresso}</p>
  {/if}
  <ul class="mb-4">
    {#each medidas as medida}
      <li>{medida}</li>
    {/each}
  </ul>
  {#if mensagem}
    <p class="mb-4">{mensagem}</p>
  {/if}

  <div class="mb-6 grid max-w-xl gap-2">
    <label class="block">
      Texto para tokenizar e consultar
      <textarea class={inputClasses} rows="4" bind:value={texto} />
    </label>
    <button class={buttonClasses} disabled={ocupado} on:click={medirTexto}>Medir consultas</button>
  </div>

  <div class="mb-4 flex max-w-xl items-end gap-2">
    <label class="block grow">
      Consultar termo
      <input class={inputClasses} bind:value={termo} />
    </label>
    <button class={buttonClasses} disabled={ocupado} on:click={buscar}>Consultar</button>
  </div>

  {#each resultado as entrada (entrada.id)}
    <div class="mb-4">
      <p class="text-lg">
        {entrada.formas
          .slice(0, 4)
          .map((f) => (f.e === f.l ? f.e : `${f.e}【${f.l}】`))
          .join('、')}
        <span class="text-sm opacity-75">
          JMdict {entrada.seq} · JPDB {entrada.formas[0].f ?? '–'} / kana {entrada.formas[0].fk ??
            '–'}
        </span>
      </p>
      <ol class="list-decimal pl-6 text-sm">
        {#each entrada.sentidos.slice(0, 4) as sentido}
          <li><span class="opacity-75">{sentido.t.join(' ')}</span> {sentido.g.join('; ')}</li>
        {/each}
      </ol>
    </div>
  {/each}
</div>
