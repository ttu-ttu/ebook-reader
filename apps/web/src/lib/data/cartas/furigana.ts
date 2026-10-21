/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { PedacoFurigana } from '$lib/data/dicionario/formato';
import { paraHiragana, type Pedaco } from '$lib/data/dicionario/tokenizador';

// Word Furigana e Sentence Furigana no formato do Anki (CARDS.md): `kanji[leitura]`, kanji por
// kanji quando o JmdictFurigana separa (最[さい] 初[しょ]), e um espaço antes de cada kanji que vem
// depois de kana, para o furigana ficar só sobre o kanji.

const KANJI = /[\p{Script=Han}々〆ヶ]/u;

/** Leitura de cada trecho de kanji, separando o kana (okurigana) que a escrita e a leitura têm. */
export function alinharLeitura(escrita: string, leitura: string): PedacoFurigana[] {
  if (!KANJI.test(escrita)) return [escrita];

  const trechos = escrita.match(/[\p{Script=Han}々〆ヶ]+|[^\p{Script=Han}々〆ヶ]+/gu) ?? [escrita];
  const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const padrao = trechos
    .map((trecho) => (KANJI.test(trecho) ? '(.+?)' : escapar(paraHiragana(trecho))))
    .join('');
  const achado = new RegExp(`^${padrao}$`, 'u').exec(paraHiragana(leitura));

  if (!achado) return [[escrita, leitura]];

  let grupo = 1;

  return trechos.map((trecho) => {
    if (!KANJI.test(trecho)) return trecho;

    const leituraDoTrecho = achado[grupo];

    grupo += 1;

    return [trecho, leituraDoTrecho];
  });
}

/** Pedaços (texto, [kanji, leitura], ou marcas como <b>) no formato de furigana do Anki. */
export function furiganaAnki(pedacos: PedacoFurigana[]) {
  let texto = '';

  for (const pedaco of pedacos) {
    if (typeof pedaco === 'string') {
      texto += pedaco;
      continue;
    }

    const [kanji, leitura] = pedaco;

    if (texto && !/[\s>]$/.test(texto)) texto += ' ';
    texto += `${kanji}[${leitura}]`;
  }

  return texto;
}

export function furiganaDaPalavra(escrita: string, leitura: string, fu?: PedacoFurigana[]) {
  return furiganaAnki(fu ?? alinharLeitura(escrita, paraHiragana(leitura)));
}

/** JmdictFurigana de uma escrita com a leitura dada, quando o dicionário tem. */
export type FuriganaDoDicionario = (
  superficie: string,
  leitura: string
) => Promise<PedacoFurigana[] | undefined>;

/**
 * Sentence Furigana: a frase com furigana em todos os kanji (JmdictFurigana ou o tokenizador) e a
 * palavra [inicio, fim) entre <b> e </b>. `pedacos` é a frase tokenizada.
 */
export async function furiganaDaFrase(
  frase: string,
  pedacos: Pedaco[],
  inicio: number,
  fim: number,
  doDicionario?: FuriganaDoDicionario
) {
  const saida: PedacoFurigana[] = [];
  let cursor = 0;

  // Texto entre pedaços (espaços que o tokenizador não devolve) e as marcas do negrito.
  const textoAte = (ate: number) => {
    for (let i = cursor; i < ate; i += 1) {
      if (i === inicio) saida.push('<b>');
      if (i === fim) saida.push('</b>');
      saida.push(frase[i]);
    }

    cursor = Math.max(cursor, ate);
  };

  for (const pedaco of pedacos) {
    const comeco = pedaco.inicio;
    const final = comeco + pedaco.superficie.length;

    textoAte(comeco);

    if (comeco < inicio && inicio < final) {
      // O negrito começa dentro do pedaço: sem furigana neste pedaço.
      textoAte(final);
      continue;
    }

    if (comeco < fim && fim < final) {
      textoAte(final);
      continue;
    }

    if (comeco === inicio) saida.push('<b>');
    if (comeco === fim) saida.push('</b>');

    const leitura = paraHiragana(pedaco.leitura);
    const fu =
      leitura && KANJI.test(pedaco.superficie)
        ? ((await doDicionario?.(pedaco.superficie, leitura)) ??
          alinharLeitura(pedaco.superficie, leitura))
        : [pedaco.superficie];

    saida.push(...fu);
    cursor = final;
  }

  textoAte(frase.length);

  if (fim >= frase.length && cursor >= frase.length && !saida.includes('</b>')) {
    saida.push('</b>');
  }

  return furiganaAnki(saida);
}
