<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import NavegacaoInferior from '$lib/components/navegacao/navegacao-inferior.svelte';
  import { ReadingGoalFrequency } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import { pagePath } from '$lib/data/env';
  import {
    barrasDoGrafico,
    diasDaSemana,
    diasDoPeriodo,
    formatarTempo,
    porLivro,
    somarDias,
    somarPorDia,
    type Dia,
    type Medida,
    type Periodo
  } from '$lib/data/estatisticas/inicio';
  import { capasDosLivros, linhasDeLeitura } from '$lib/data/estatisticas/carregar';
  import { getReadingGoalWindow } from '$lib/data/reading-goal';
  import { database, readingGoal$, startDayHoursForTracker$ } from '$lib/data/store';
  import { estatisticasRecebidas$ } from '$lib/data/supabase/sincronizacao/iniciar';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { getDateKey } from '$lib/functions/statistic-util';

  // Tela Início (ESCOPO "Tela inicial"; desenho do D1): calendário da semana, meta, progresso de
  // tempo e caracteres somando os aparelhos, gráfico por dia, filtro e lista por livro.

  const DIAS_CURTOS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const DIAS_LONGOS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  let porDia = new Map<string, Dia>();
  let primeiroDia: string | undefined;
  let capas = new Map<string, string>();
  let semana = 0;
  let diaEscolhido: string | undefined;
  let medida: Medida = 'tempo';
  let periodo: Periodo = 7;
  let carregado = false;

  $: hoje = getDateKey($startDayHoursForTracker$);
  $: dias = diasDaSemana(hoje, semana);
  $: diasDoFiltro = diasDoPeriodo(hoje, periodo, primeiroDia);
  $: total = somarDias(porDia, diasDoFiltro)[medida];
  $: barras = barrasDoGrafico(porDia, diasDoFiltro, medida);
  $: maiorBarra = Math.max(1, ...barras.map((barra) => barra.valor));
  $: livros = porLivro(porDia, diasDoFiltro, medida);
  $: maiorLivro = livros[0]?.valor || 1;
  $: meta = $readingGoal$;
  $: janela = meta?.goalStartDate
    ? getReadingGoalWindow(hoje, $startDayHoursForTracker$, meta)
    : [hoje, hoje, ''];
  $: diasDaMeta = diasDoPeriodo(janela[1], 'tudo', janela[0]);
  $: feitoNaMeta = somarDias(porDia, diasDaMeta);
  $: temMeta = !!meta && (meta.timeGoal > 0 || meta.characterGoal > 0);
  $: nomeDaMeta =
    meta?.goalFrequency === ReadingGoalFrequency.WEEKLY
      ? 'da semana'
      : meta?.goalFrequency === ReadingGoalFrequency.MONTHLY
        ? 'do mês'
        : 'de hoje';
  $: semanaTexto =
    semana === 0
      ? 'Esta semana'
      : semana === -1
        ? 'Semana passada'
        : `${dataCurta(dias[0])} a ${dataCurta(dias[6])}`;

  const formatar = (valor: number, qual: Medida) =>
    qual === 'tempo' ? formatarTempo(valor) : `${valor.toLocaleString('pt-BR')}`;

  function dataCurta(dia: string) {
    const [, mes, d] = dia.split('-');

    return `${d}/${mes}`;
  }

  async function carregar() {
    const linhas = await linhasDeLeitura();

    porDia = somarPorDia(linhas);
    primeiroDia = linhas.reduce<string | undefined>(
      (menor, linha) => (!menor || linha.dia < menor ? linha.dia : menor),
      undefined
    );
    carregado = true;
  }

  onMount(() => {
    const assinaturas = [
      estatisticasRecebidas$.subscribe(carregar),
      database.mudou$.subscribe(carregar)
    ];

    carregar();
    capasDosLivros().then((achadas) => (capas = achadas));

    return () => assinaturas.forEach((assinatura) => assinatura.unsubscribe());
  });

  onDestroy(() => capas.forEach((url) => URL.revokeObjectURL(url)));
</script>

<svelte:head>
  <title>{formatPageTitle('Início')}</title>
</svelte:head>

<main class="dokusho-inicio">
  <header>
    <h1>Início</h1>
    <a href="{pagePath}/settings" aria-label="Configurações" class="dokusho-inicio__icone">⚙</a>
  </header>

  <section class="dokusho-cartao">
    <div class="dokusho-inicio__semana-cabeca">
      <button aria-label="Semana anterior" on:click={() => (semana -= 1)}>‹</button>
      <div>
        <b>{semanaTexto}</b>
        <small>{dataCurta(dias[0])} a {dataCurta(dias[6])}</small>
      </div>
      <button aria-label="Próxima semana" disabled={semana >= 0} on:click={() => (semana += 1)}
        >›</button
      >
    </div>
    <div class="dokusho-inicio__semana">
      {#each dias as dia, i}
        <div>
          <small>{DIAS_CURTOS[i]}</small>
          <button
            class:lido={(porDia.get(dia)?.tempo ?? 0) > 0 || (porDia.get(dia)?.caracteres ?? 0) > 0}
            class:hoje={dia === hoje}
            class:escolhido={dia === diaEscolhido}
            disabled={dia > hoje}
            aria-label="{DIAS_LONGOS[i]} {dataCurta(dia)}"
            on:click={() => (diaEscolhido = diaEscolhido === dia ? undefined : dia)}
          >
            {Number(dia.slice(8))}
          </button>
        </div>
      {/each}
    </div>
    {#if diaEscolhido}
      {@const escolhido = porDia.get(diaEscolhido)}
      <p class="dokusho-inicio__detalhe">
        {DIAS_LONGOS[dias.indexOf(diaEscolhido)] ?? ''}, {dataCurta(diaEscolhido)} ·
        {#if escolhido && (escolhido.tempo || escolhido.caracteres)}
          {formatarTempo(escolhido.tempo)} · {escolhido.caracteres.toLocaleString('pt-BR')} caracteres
        {:else}
          sem leitura
        {/if}
      </p>
    {/if}
  </section>

  <section class="dokusho-cartao dokusho-inicio__meta">
    <div>
      {#if temMeta}
        <small>Meta {nomeDaMeta}</small>
        {#if meta.timeGoal}
          <p>
            <b>{formatarTempo(feitoNaMeta.tempo)}</b> de {formatarTempo(meta.timeGoal)}
          </p>
          <div class="dokusho-inicio__barra">
            <i style:width="{Math.min(100, (100 * feitoNaMeta.tempo) / meta.timeGoal)}%" />
          </div>
        {/if}
        {#if meta.characterGoal}
          <p>
            <b>{feitoNaMeta.caracteres.toLocaleString('pt-BR')}</b> de
            {meta.characterGoal.toLocaleString('pt-BR')} caracteres
          </p>
          <div class="dokusho-inicio__barra">
            <i
              style:width="{Math.min(100, (100 * feitoNaMeta.caracteres) / meta.characterGoal)}%"
            />
          </div>
        {/if}
      {:else}
        <small>Sem meta</small>
      {/if}
    </div>
    <a class="dokusho-botao" href="{pagePath}/settings?aba=Statistics">Definir meta</a>
  </section>

  <section>
    <h2>Progresso de leitura</h2>
    <div class="dokusho-abas">
      <button class:ativa={medida === 'tempo'} on:click={() => (medida = 'tempo')}>Tempo</button>
      <button class:ativa={medida === 'caracteres'} on:click={() => (medida = 'caracteres')}
        >Caracteres</button
      >
      <button disabled title="Chega na v2">Palavras <small>v2</small></button>
    </div>
    <p class="dokusho-inicio__total">
      <b>{formatar(total, medida)}</b>
      {medida === 'caracteres' ? 'caracteres ' : ''}{periodo === 'tudo'
        ? primeiroDia
          ? `desde ${dataCurta(primeiroDia)}`
          : ''
        : `nos últimos ${periodo} dias`}
    </p>
    <div class="dokusho-cartao">
      <svg class="dokusho-inicio__grafico" viewBox="0 0 320 110" role="img" aria-label="Gráfico">
        {#each barras as barra, i}
          {@const largura = 320 / barras.length}
          {@const altura = (90 * barra.valor) / maiorBarra}
          <rect
            x={i * largura + largura * 0.15}
            y={95 - altura}
            width={largura * 0.7}
            height={altura}
            rx="2"
            class:hoje={barra.rotulo === hoje}
          >
            <title>{dataCurta(barra.rotulo)}: {formatar(barra.valor, medida)}</title>
          </rect>
        {/each}
        <line x1="0" y1="95.5" x2="320" y2="95.5" />
        {#if barras.length}
          <text x="0" y="108">{dataCurta(barras[0].rotulo)}</text>
          <text x="320" y="108" text-anchor="end"
            >{dataCurta(barras[barras.length - 1].rotulo)}</text
          >
        {/if}
      </svg>
    </div>
    <div class="dokusho-abas">
      <button class:ativa={periodo === 7} on:click={() => (periodo = 7)}>7 dias</button>
      <button class:ativa={periodo === 30} on:click={() => (periodo = 30)}>30 dias</button>
      <button class:ativa={periodo === 'tudo'} on:click={() => (periodo = 'tudo')}>Tudo</button>
    </div>
  </section>

  <section>
    <h2>Por livro</h2>
    {#each livros as { livro, valor }}
      <div class="dokusho-inicio__livro">
        {#if capas.get(livro)}
          <img src={capas.get(livro)} alt="" />
        {:else}
          <span class="dokusho-inicio__sem-capa" />
        {/if}
        <div>
          <div class="dokusho-inicio__titulo">{livro}</div>
          <div class="dokusho-inicio__parte"><i style:width="{(100 * valor) / maiorLivro}%" /></div>
        </div>
        <small>{formatar(valor, medida)}</small>
      </div>
    {:else}
      <p class="dokusho-inicio__vazio">{carregado ? 'Nada lido neste período.' : 'Carregando…'}</p>
    {/each}
  </section>
</main>

<NavegacaoInferior />

<style lang="scss">
  .dokusho-inicio {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 18px calc(96px + env(safe-area-inset-bottom, 0px));
    font-family: 'Noto Sans JP', system-ui, sans-serif;
    color: var(--dk-ink);

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 22px 0 10px;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
    }

    h2 {
      margin: 22px 0 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--dk-ink2);
    }
  }

  .dokusho-inicio__icone {
    font-size: 22px;
    padding: 8px;
    color: var(--dk-ink2);
  }

  .dokusho-cartao {
    background: var(--dk-surface);
    border-radius: 16px;
    padding: 14px;
    margin-top: 12px;
    box-shadow: 0 1px 3px var(--dk-shadow);
  }

  .dokusho-inicio__semana-cabeca {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: center;

    button {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      font-size: 24px;

      &:disabled {
        opacity: 0.3;
      }
    }

    small {
      display: block;
      color: var(--dk-ink3);
    }
  }

  .dokusho-inicio__semana {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    text-align: center;
    margin-top: 10px;

    small {
      font-size: 12px;
      color: var(--dk-ink3);
    }

    button {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      margin: 4px auto 0;
      border-radius: 50%;
      font-size: 14px;
      box-shadow: inset 0 0 0 1.5px var(--dk-line);

      &.lido {
        background: var(--dk-accent);
        color: var(--dk-accent-ink);
        box-shadow: none;
      }

      &.hoje {
        outline: 2px solid var(--dk-accent);
        outline-offset: 2px;
      }

      &.escolhido {
        outline: 2px dashed var(--dk-ink3);
        outline-offset: 3px;
      }

      &:disabled {
        opacity: 0.4;
      }
    }
  }

  .dokusho-inicio__detalhe {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--dk-sunk);
    font-size: 14px;
  }

  .dokusho-inicio__meta {
    display: flex;
    align-items: center;
    gap: 14px;

    > div {
      flex: 1;
    }

    small {
      color: var(--dk-ink2);
    }

    p {
      margin-top: 4px;
    }

    b {
      font-size: 18px;
    }
  }

  .dokusho-inicio__barra,
  .dokusho-inicio__parte {
    height: 8px;
    border-radius: 4px;
    background: var(--dk-sunk);
    overflow: hidden;
    margin-top: 6px;

    i {
      display: block;
      height: 100%;
      background: var(--dk-read);
    }
  }

  .dokusho-inicio__parte {
    height: 4px;

    i {
      background: var(--dk-accent);
      opacity: 0.55;
    }
  }

  .dokusho-botao {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 12px;
    font-weight: 700;
    background: var(--dk-sunk);
  }

  .dokusho-abas {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 11px;
    background: var(--dk-sunk);
    margin-top: 10px;

    button {
      flex: 1;
      min-height: 34px;
      border-radius: 9px;
      font-size: 14px;
      color: var(--dk-ink2);

      &.ativa {
        background: var(--dk-surface);
        color: var(--dk-ink);
        box-shadow: 0 1px 3px var(--dk-shadow);
      }

      &:disabled {
        opacity: 0.45;
      }
    }
  }

  .dokusho-inicio__total {
    margin: 14px 0 4px;
    color: var(--dk-ink2);

    b {
      font-size: 30px;
      color: var(--dk-ink);
      margin-right: 6px;
    }
  }

  .dokusho-inicio__grafico {
    width: 100%;
    height: auto;

    rect {
      fill: var(--dk-accent);

      &.hoje {
        fill: var(--dk-read);
      }
    }

    line {
      stroke: var(--dk-line);
    }

    text {
      font-size: 10px;
      fill: var(--dk-ink3);
    }
  }

  .dokusho-inicio__livro {
    display: grid;
    grid-template-columns: 34px 1fr auto;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;

    img,
    .dokusho-inicio__sem-capa {
      width: 34px;
      height: 48px;
      border-radius: 4px;
      object-fit: cover;
      background: var(--dk-line);
    }

    small {
      color: var(--dk-ink2);
    }
  }

  .dokusho-inicio__titulo {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dokusho-inicio__vazio {
    padding: 28px 10px;
    text-align: center;
    color: var(--dk-ink3);
    font-size: 14px;
  }
</style>
