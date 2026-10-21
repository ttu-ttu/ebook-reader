/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Do toque no livro ao texto do parágrafo: o parágrafo vira um texto sem o furigana do EPUB
// (sem <rt>), com o mapa de volta para os nós (para pintar a seleção) e as leituras dos <ruby>
// (a entrada que bate com o furigana do livro vem primeiro no painel).

export const SELETOR_PARAGRAFO = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd';

interface Trecho {
  no: Text;
  inicio: number;
}

export interface Rubi {
  inicio: number;
  fim: number;
  leitura: string;
}

export interface ParagrafoDoLivro {
  elemento: Element;
  texto: string;
  trechos: Trecho[];
  rubis: Rubi[];
}

const ignorado = (no: Node) =>
  !!(no.parentElement && no.parentElement.closest('rt, rp, script, style'));

export function paragrafoDe(no: Node, raiz: Element): Element | undefined {
  const elemento = no instanceof Element ? no : no.parentElement;
  const paragrafo = elemento?.closest(SELETOR_PARAGRAFO);

  if (paragrafo && raiz.contains(paragrafo)) return paragrafo;

  // Texto fora de um parágrafo marcado (div com texto direto): o próprio pai.
  return elemento && raiz.contains(elemento) && elemento !== raiz ? elemento : undefined;
}

const cache = new WeakMap<Element, ParagrafoDoLivro>();

export function lerParagrafo(elemento: Element): ParagrafoDoLivro {
  const guardado = cache.get(elemento);

  if (guardado) return guardado;

  const trechos: Trecho[] = [];
  const rubis: Rubi[] = [];
  let texto = '';
  const caminhante = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);

  for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) {
    if (ignorado(no)) continue;

    const ruby = no.parentElement?.closest('ruby');
    const inicio = texto.length;

    trechos.push({ no: no as Text, inicio });
    texto += no.textContent ?? '';

    if (ruby && elemento.contains(ruby)) {
      const leitura = [...ruby.querySelectorAll('rt')].map((rt) => rt.textContent ?? '').join('');
      const anterior = rubis[rubis.length - 1];

      if (anterior && anterior.leitura === leitura && anterior.fim === inicio) {
        anterior.fim = texto.length;
      } else if (leitura) {
        rubis.push({ inicio, fim: texto.length, leitura });
      }
    }
  }

  const paragrafo = { elemento, texto, trechos, rubis };

  cache.set(elemento, paragrafo);

  return paragrafo;
}

export function posicaoNoParagrafo(paragrafo: ParagrafoDoLivro, no: Node, deslocamento: number) {
  const trecho = paragrafo.trechos.find((t) => t.no === no);

  return trecho ? trecho.inicio + deslocamento : -1;
}

/** Range do DOM para [inicio, fim) do texto do parágrafo. */
export function rangeDoTexto(paragrafo: ParagrafoDoLivro, inicio: number, fim: number) {
  const range = document.createRange();
  const achar = (posicao: number, noFim: boolean) => {
    for (let i = paragrafo.trechos.length - 1; i >= 0; i -= 1) {
      const trecho = paragrafo.trechos[i];
      const tamanho = trecho.no.textContent?.length ?? 0;

      if (posicao > trecho.inicio || (posicao === trecho.inicio && !noFim)) {
        return { no: trecho.no, deslocamento: Math.min(posicao - trecho.inicio, tamanho) };
      }
    }

    return { no: paragrafo.trechos[0].no, deslocamento: 0 };
  };
  const a = achar(inicio, false);
  const b = achar(fim, true);

  range.setStart(a.no, a.deslocamento);
  range.setEnd(b.no, b.deslocamento);

  return range;
}

/** Leitura do furigana do EPUB que cobre exatamente a seleção (ou a contém). */
export function rubiDaSelecao(paragrafo: ParagrafoDoLivro, inicio: number, fim: number) {
  return paragrafo.rubis.find((rubi) => rubi.inicio <= inicio && fim <= rubi.fim)?.leitura;
}

const TOLERANCIA = 6;

/**
 * O caractere sob o toque, com uma margem em volta (área de toque generosa). undefined quando o
 * toque cai fora do texto (margem, entre parágrafos, depois do fim da linha).
 */
export function caractereNoPonto(x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let no: Node | undefined;
  let deslocamento = 0;

  if (doc.caretPositionFromPoint) {
    const posicao = doc.caretPositionFromPoint(x, y);

    no = posicao?.offsetNode;
    deslocamento = posicao?.offset ?? 0;
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);

    no = range?.startContainer;
    deslocamento = range?.startOffset ?? 0;
  }

  if (!no || no.nodeType !== Node.TEXT_NODE || ignorado(no)) return undefined;

  const tamanho = no.textContent?.length ?? 0;

  // O caret fica entre caracteres: confere o da direita e o da esquerda.
  for (const candidato of [deslocamento, deslocamento - 1]) {
    if (candidato < 0 || candidato >= tamanho) continue;

    const range = document.createRange();

    range.setStart(no, candidato);
    range.setEnd(no, candidato + 1);

    for (const caixa of range.getClientRects()) {
      if (
        x >= caixa.left - TOLERANCIA &&
        x <= caixa.right + TOLERANCIA &&
        y >= caixa.top - TOLERANCIA &&
        y <= caixa.bottom + TOLERANCIA
      ) {
        return { no: no as Text, deslocamento: candidato };
      }
    }
  }

  return undefined;
}
