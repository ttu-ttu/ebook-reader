<script lang="ts">
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import { pagePath } from '$lib/data/env';
  import { isOnline$ } from '$lib/data/store';
  import { pedirDicionario } from '$lib/components/dicionario/pedir-dicionario';
  import { ajustarSelecao, selecionar, type Selecao } from '$lib/data/dicionario/busca';
  import type { Entrada } from '$lib/data/dicionario/formato';
  import { consultarPalavra, tokenizador } from '$lib/data/dicionario/servico';
  import { paraHiragana, type Pedaco } from '$lib/data/dicionario/tokenizador';
  import { contextoDaFrase, fraseEm } from '$lib/data/cartas/frase';
  import { formaDaEntrada, montarCarta, ordenarEntradas } from '$lib/data/cartas/palavra';
  import { gerarPendentes } from '$lib/data/cartas/fila';
  import { traducaoEmCache, traduzirFrase } from '$lib/data/cartas/traduzir';
  import {
    cartasRecebidas$,
    sincronizador,
    sincronizarEmBreve
  } from '$lib/data/supabase/sincronizacao/iniciar';
  import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';
  import { marcarLidos, mapearLivro, type MapaDoLivro } from './alcance-dom';
  import PainelPalavra from './painel-palavra.svelte';
  import {
    caractereNoPonto,
    lerParagrafo,
    paragrafoDe,
    posicaoNoParagrafo,
    rangeDoTexto,
    rubiDaSelecao,
    SELETOR_PARAGRAFO,
    type ParagrafoDoLivro
  } from './texto-do-dom';

  // O que o Dokusho põe no leitor do ttu (V1.3): toque na palavra e painel (ADR 0003, 0005), a
  // barra verde dos parágrafos lidos pelo Alcance e a barra do topo que aparece ao rolar para cima.

  export let titulo: string;
  export let htmlContent: string;
  export let exploredCharCount: number;
  export let verticalMode: boolean;
  export let isPaginated: boolean;
  export let corFundo: string;
  export let corTexto: string;
  /** A barra do topo do ttu (showHeader). */
  export let mostrarBarra = false;

  const REALCE = 'dokusho-selecao';

  let aberto = false;
  let paragrafo: ParagrafoDoLivro | undefined;
  let pedacos: Pedaco[] = [];
  let selecao: Selecao | undefined;
  let entradas: Entrada[] = [];
  let indiceEntrada = 0;
  let rubi: string | undefined;
  let carregando = '';
  let cartas: LinhaCarta[] = [];
  let traducao: { frase: string; texto: string; cache: boolean } | undefined;
  let traduzindo = false;
  let erro = '';
  let confirmarDuplicada = false;
  let mapa: MapaDoLivro | undefined;
  let alcance = 0;
  let ultimaRolagem: number | undefined;
  let toque = 0;
  let aEsquerda = false;

  const tokenizados = new WeakMap<Element, Pedaco[]>();

  $: podeEncurtar = !!selecao && selecao.ultimo > selecao.primeiro;
  $: podeAlongar = !!selecao && selecao.ultimo + 1 < pedacos.length;
  $: if (exploredCharCount) atualizarAlcance(exploredCharCount);

  function conteudo() {
    return document.querySelector('.book-content');
  }

  function pintar(range?: Range) {
    const css = globalThis.CSS as unknown as {
      highlights?: Map<string, unknown>;
    };
    const Destaque = (globalThis as unknown as { Highlight?: new (r: Range) => unknown }).Highlight;

    if (!css?.highlights || !Destaque) return;
    if (range) css.highlights.set(REALCE, new Destaque(range));
    else css.highlights.delete(REALCE);
  }

  export function fechar() {
    aberto = false;
    selecao = undefined;
    traducao = undefined;
    confirmarDuplicada = false;
    erro = '';
    pintar();
  }

  async function aoTocar(evento: MouseEvent) {
    const alvo = evento.target as Element | null;

    if (!alvo || alvo.closest('.dokusho-painel')) return;

    const raiz = conteudo();

    if (!raiz || !raiz.contains(alvo)) {
      // Fora do texto: só fecha o painel (regra B). Botões do leitor seguem com o ttu.
      if (aberto && !alvo.closest('button, a, input, [role="button"]')) fechar();
      return;
    }

    if (alvo.closest('a, img, svg, button')) return;

    const ponto = caractereNoPonto(evento.clientX, evento.clientY);
    const elemento = ponto && paragrafoDe(ponto.no, raiz);

    if (!ponto || !elemento) {
      if (aberto) fechar();
      return;
    }

    const lido = lerParagrafo(elemento);
    const posicao = posicaoNoParagrafo(lido, ponto.no, ponto.deslocamento);

    if (posicao < 0) return;

    const meu = (toque += 1);

    if (!(await pedirDicionario())) return;

    let tk;

    if (!tokenizados.has(elemento)) {
      carregando = 'Carregando o tokenizador…';
      aberto = true;
      selecao = undefined;

      try {
        tk = await tokenizador();
      } catch (e) {
        carregando = '';
        erro = e instanceof Error ? e.message : String(e);
        return;
      }

      tokenizados.set(elemento, tk.tokenizar(lido.texto));
      carregando = '';
    }

    const pedacosDoParagrafo = tokenizados.get(elemento) as Pedaco[];
    const achada = await selecionar(consultarPalavra, pedacosDoParagrafo, posicao);

    if (meu !== toque) return;

    if (!achada) {
      // Pontuação: só fecha o painel.
      if (aberto) fechar();
      return;
    }

    paragrafo = lido;
    pedacos = pedacosDoParagrafo;
    aEsquerda = evento.clientX > window.innerWidth / 2;
    await mostrar(achada);
    mostrarBarra = false;
  }

  async function mostrar(nova: Selecao) {
    if (!paragrafo) return;

    selecao = nova;
    rubi = rubiDaSelecao(paragrafo, nova.inicio, nova.fim);

    const leituraDoTexto =
      rubi ||
      (nova.primeiro === nova.ultimo && pedacos[nova.primeiro].superficie === nova.termo
        ? pedacos[nova.primeiro].leitura
        : undefined);

    entradas = ordenarEntradas(nova.entradas, leituraDoTexto && paraHiragana(leituraDoTexto));
    indiceEntrada = 0;
    traducao = undefined;
    confirmarDuplicada = false;
    erro = '';
    aberto = true;
    pintar(rangeDoTexto(paragrafo, nova.inicio, nova.fim));
    await atualizarCartas();
    await mostrarTraducaoEmCache();
    rolarParaVer();
  }

  function rolarParaVer() {
    if (!paragrafo || !selecao || verticalMode || isPaginated || window.innerWidth >= 768) return;

    requestAnimationFrame(() => {
      if (!paragrafo || !selecao) return;

      const caixa = rangeDoTexto(paragrafo, selecao.inicio, selecao.fim).getBoundingClientRect();
      const painel = document.querySelector('.dokusho-painel')?.getBoundingClientRect();
      const limite = (painel?.top ?? window.innerHeight) - 24;

      if (caixa.bottom > limite)
        window.scrollBy({ top: caixa.bottom - limite, behavior: 'smooth' });
    });
  }

  function palavraAtual() {
    const entrada = entradas[indiceEntrada];

    return entrada && selecao ? formaDaEntrada(entrada, selecao.termo, rubi) : undefined;
  }

  async function atualizarCartas() {
    const palavra = palavraAtual();

    cartas = palavra ? await sincronizador().cartasDaPalavra(palavra.escrita, palavra.leitura) : [];
  }

  function fraseAtual() {
    if (!paragrafo || !selecao) return undefined;

    const frase = fraseEm(paragrafo.texto, selecao.inicio, selecao.fim);
    const vizinhos = vizinhosDoParagrafo(paragrafo.elemento);

    return { frase, contexto: contextoDaFrase(paragrafo.texto, frase, ...vizinhos), vizinhos };
  }

  function vizinhosDoParagrafo(elemento: Element): [string, string] {
    const todos = [...(conteudo()?.querySelectorAll(SELETOR_PARAGRAFO) ?? [])];
    const i = todos.indexOf(elemento);
    const texto = (e?: Element) => (e ? lerParagrafo(e).texto : '');

    return [texto(todos[i - 1]), texto(todos[i + 1])];
  }

  async function mostrarTraducaoEmCache() {
    const atual = fraseAtual();

    if (!atual) return;

    const emCache = await traducaoEmCache(atual.frase.frase).catch(() => undefined);

    if (emCache) traducao = { frase: atual.frase.frase, texto: emCache, cache: true };
  }

  async function traduzir() {
    const atual = fraseAtual();

    if (!atual) return;

    traduzindo = true;
    erro = '';

    try {
      const { traducao: texto, cache } = await traduzirFrase(
        atual.frase.frase,
        atual.contexto.antes,
        atual.contexto.depois
      );

      traducao = { frase: atual.frase.frase, texto, cache };
      sincronizarEmBreve();
    } catch (e) {
      erro = `Tradução: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      traduzindo = false;
    }
  }

  async function criarCarta(mesmoAssim: boolean) {
    if (!paragrafo || !selecao) return;

    if (!mesmoAssim && cartas.some((carta) => carta.state === 'exportada')) {
      confirmarDuplicada = true;
      return;
    }

    erro = '';

    try {
      const tk = await tokenizador();
      const [anterior, seguinte] = vizinhosDoParagrafo(paragrafo.elemento);
      const entrada = entradas[indiceEntrada];
      const carta = await montarCarta({
        id: crypto.randomUUID(),
        agora: new Date().toISOString(),
        livroId: (await sincronizador().idDoLivro(titulo)) ?? '',
        entrada,
        termo: entrada ? selecao.termo : selecao.texto,
        leituraPreferida: rubi,
        paragrafo: paragrafo.texto,
        inicio: selecao.inicio,
        fim: selecao.fim,
        paragrafoAnterior: anterior,
        paragrafoSeguinte: seguinte,
        tokenizar: (texto) => tk.tokenizar(texto),
        furiganaDoDicionario: async (superficie, leitura) =>
          (await consultarPalavra(superficie))
            .flatMap((e) => e.formas)
            .find((f) => f.e === superficie && paraHiragana(f.l) === leitura && f.fu)?.fu
      });

      await sincronizador().salvar('cartas', { ...carta, book_id: carta.book_id || null });
      confirmarDuplicada = false;
      // Sobe a carta e pede a parte do Gemini (ADR 0010); offline, fica pendente.
      gerarPendentes();
      await atualizarCartas();
    } catch (e) {
      erro = `Criar carta: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function ajustar(delta: -1 | 1) {
    if (!selecao) return;

    await mostrar(await ajustarSelecao(consultarPalavra, pedacos, selecao, delta));
  }

  async function escolherEntrada(i: number) {
    indiceEntrada = i;
    confirmarDuplicada = false;
    await atualizarCartas();
  }

  let marcando: ReturnType<typeof setTimeout> | undefined;

  function marcarDepois() {
    clearTimeout(marcando);
    marcando = setTimeout(() => {
      const raiz = conteudo();

      if (!raiz || !htmlContent) return;
      if (!mapa) mapa = mapearLivro(htmlContent);

      marcarLidos(raiz, mapa, alcance);
    }, 300);
  }

  async function atualizarAlcance(explorado: number) {
    if (!titulo) return;

    alcance = await sincronizador().registrarAlcance(titulo, explorado);
    marcarDepois();
  }

  /** "Desmarcar a partir daqui" (menu do leitor): o Alcance volta para o ponto atual. */
  export async function desmarcarAPartirDaqui() {
    await sincronizador().desmarcarAPartirDe(titulo, exploredCharCount);
    alcance = exploredCharCount;
    marcarDepois();
  }

  function aoRolar() {
    if (isPaginated || aberto) {
      ultimaRolagem = undefined;
      return;
    }

    // Avanço da leitura: para baixo no horizontal, para a esquerda no vertical (vertical-rl).
    const posicao = verticalMode ? -window.scrollX : window.scrollY;

    if (ultimaRolagem === undefined) {
      ultimaRolagem = posicao;
      return;
    }

    const delta = posicao - ultimaRolagem;

    if (Math.abs(delta) < 12) return;

    mostrarBarra = delta < 0;
    ultimaRolagem = posicao;
  }

  let observador: MutationObserver | undefined;

  onMount(() => {
    window.addEventListener('click', aoTocar);
    window.addEventListener('scroll', aoRolar, { passive: true });

    const assinatura = cartasRecebidas$.subscribe(() => atualizarCartas());

    sincronizador()
      .alcanceDe(titulo)
      .then((valor) => {
        alcance = Math.max(valor, alcance);
        marcarDepois();
      });

    // No modo de páginas o ttu troca a seção na tela: marca de novo.
    observador = new MutationObserver(marcarDepois);

    const raiz = conteudo();

    if (raiz) observador.observe(raiz, { childList: true, subtree: true });

    return () => assinatura.unsubscribe();
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;

    window.removeEventListener('click', aoTocar);
    window.removeEventListener('scroll', aoRolar);
    observador?.disconnect();
    clearTimeout(marcando);
    pintar();
  });
</script>

{#if aberto}
  <PainelPalavra
    {selecao}
    {entradas}
    {indiceEntrada}
    {rubi}
    {carregando}
    {cartas}
    {traducao}
    {traduzindo}
    {erro}
    {podeEncurtar}
    {podeAlongar}
    {confirmarDuplicada}
    {corFundo}
    {corTexto}
    {aEsquerda}
    online={$isOnline$}
    on:encurtar={() => ajustar(-1)}
    on:alongar={() => ajustar(1)}
    on:entrada={(e) => escolherEntrada(e.detail)}
    on:fechar={fechar}
    on:traduzir={traduzir}
    on:criarCarta={(e) => criarCarta(e.detail.mesmoAssim)}
    on:abrirCarta={(e) => goto(`${pagePath}/fila?carta=${e.detail}`)}
  />
{/if}
