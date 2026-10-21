/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { getParagraphNodes } from '$lib/components/book-reader/get-paragraph-nodes';
import { getCharacterCount } from '$lib/functions/get-character-count';
import { SELETOR_PARAGRAFO } from './texto-do-dom';

// Barra verde dos parágrafos lidos (ESCOPO "Parágrafos lidos"): o parágrafo fica lido quando o
// Alcance passa do fim dele. O fim de cada parágrafo é contado como o ttu conta o marcador
// (getParagraphNodes + getCharacterCount), no HTML inteiro do livro; no modo de páginas o leitor
// mostra uma seção por vez, então o mapa guarda os parágrafos por seção.

export const CLASSE_LIDO = 'dokusho-lido';

interface Secao {
  /** Fim (em caracteres desde o começo do livro) de cada parágrafo da seção, em ordem. */
  fins: number[];
  /** Começo do texto do primeiro parágrafo, para reconhecer a seção na tela. */
  assinatura: string;
}

export interface MapaDoLivro {
  secoes: Secao[];
  total: number;
}

function paragrafosEFins(raiz: Element, inicio: number) {
  const paragrafos: Element[] = [];
  const fins: number[] = [];
  let contados = inicio;

  for (const no of getParagraphNodes(raiz)) {
    contados += getCharacterCount(no);

    const elemento = no instanceof Element ? no : no.parentElement;
    const paragrafo = elemento?.closest(SELETOR_PARAGRAFO);

    if (!paragrafo || !raiz.contains(paragrafo)) continue;

    if (paragrafos[paragrafos.length - 1] === paragrafo) {
      fins[fins.length - 1] = contados;
    } else {
      paragrafos.push(paragrafo);
      fins.push(contados);
    }
  }

  return { paragrafos, fins, contados };
}

const assinaturaDe = (paragrafo: Element | undefined) =>
  (paragrafo?.textContent ?? '').replace(/\s/g, '').slice(0, 40);

export function mapearLivro(htmlContent: string): MapaDoLivro {
  const temporario = document.createElement('div');

  temporario.innerHTML = htmlContent;

  const secoes: Secao[] = [];
  let total = 0;

  for (const secao of Array.from(temporario.children)) {
    const { paragrafos, fins, contados } = paragrafosEFins(secao, total);

    secoes.push({ fins, assinatura: assinaturaDe(paragrafos[0]) });
    total = contados;
  }

  return { secoes, total };
}

/** Marca os parágrafos lidos do que está na tela (o livro inteiro ou uma seção). */
export function marcarLidos(conteudo: Element, mapa: MapaDoLivro, alcance: number) {
  const { paragrafos } = paragrafosEFins(conteudo, 0);
  const todos = mapa.secoes.flatMap((secao) => secao.fins);
  let fins: number[] | undefined;

  if (paragrafos.length === todos.length) {
    fins = todos;
  } else {
    const assinatura = assinaturaDe(paragrafos[0]);

    fins = mapa.secoes.find(
      (secao) => secao.fins.length === paragrafos.length && secao.assinatura === assinatura
    )?.fins;
  }

  if (!fins) return;

  paragrafos.forEach((paragrafo, i) => {
    paragrafo.classList.toggle(CLASSE_LIDO, (fins as number[])[i] <= alcance);
  });
}
