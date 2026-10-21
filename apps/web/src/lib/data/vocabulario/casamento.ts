/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { Entrada } from '$lib/data/dicionario/formato';
import { ehGramaticaPedaco, verboDoPotencial } from '$lib/data/dicionario/busca';
import { paraHiragana, type Pedaco } from '$lib/data/dicionario/tokenizador';

// Casamento texto ↔ Anki pela entrada do JMdict (ADR 0008, 0013): o Card e a palavra do texto são
// a mesma Palavra quando caem na mesma entrada (seq), com qualquer leitura. A leitura só escolhe a
// entrada no texto (方 かた × 方 ほう).

/** Palavra do lado do hub: entrada do JMdict + leitura em hiragana. */
export interface PalavraJmdict {
  seq: number;
  leitura: string;
}

/** Entradas cuja escrita ou leitura é o termo, da mais frequente para a menos (como `consultar`). */
export type Consulta = (termo: string) => Promise<Entrada[]>;

export const chavePalavra = ({ seq, leitura }: PalavraJmdict) => `${seq}|${leitura}`;

/** Palavras dos Cards por entrada: seq → leituras que o Anki tem. */
export type IndiceAnki = Map<number, string[]>;

export function indexarAnki(palavras: Iterable<PalavraJmdict>): IndiceAnki {
  const indice: IndiceAnki = new Map();
  for (const { seq, leitura } of palavras) {
    const leituras = indice.get(seq);
    if (!leituras) indice.set(seq, [leitura]);
    else if (!leituras.includes(leitura)) leituras.push(leitura);
  }
  return indice;
}

/**
 * Leituras do Anki para a entrada da palavra do texto; `outraLeitura` quando nenhuma é a do texto
 * (o painel mostra "no Anki como <leitura>"). undefined: a entrada não está no Anki.
 */
export function noAnki(indice: IndiceAnki, { seq, leitura }: PalavraJmdict) {
  const leituras = indice.get(seq);
  return leituras && { leituras, outraLeitura: !leituras.includes(leitura) };
}

const SO_KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

/** Campo do Anki sem HTML, espaços e o til de sufixo (〜さん). */
export function limparCampo(campo: string) {
  return campo
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .replace(/^[〜~～]+/, '')
    .trim();
}

/** Leituras do Word Reading, em hiragana; o Kaishi junta mais de uma com ・ (何 → なに・なん). */
export function leiturasDoCampo(campo: string) {
  return limparCampo(campo)
    .split(/[・、,，/／;；\s]+/)
    .filter(Boolean)
    .map(paraHiragana);
}

const sem = <T>(lista: T[], chave: (x: T) => string) => {
  const vistas = new Set<string>();
  return lista.filter((x) => !vistas.has(chave(x)) && !!vistas.add(chave(x)));
};

/**
 * Liga um Card (Word, Word Reading) às entradas do JMdict: uma Palavra por leitura do campo.
 * Valem as entradas que têm a escrita do Card (R4: ligar todas as da leitura punha 三 no Card さん e
 * 51 entradas no こう). Card só em kana, ou sem entrada com a escrita dele, liga também a mais
 * frequente com a leitura: a mesma que `casarPedaco` escolhe no texto (なる → 成る).
 * Mesma escrita e mesma leitura em mais de uma entrada liga todas e marca `ambiguo`.
 * Sem Palavras: o Card fica guardado pela escrita.
 */
export async function casarCard(consultar: Consulta, word: string, wordReading: string) {
  const escrita = limparCampo(word);
  let leituras = leiturasDoCampo(wordReading);
  if (!leituras.length && SO_KANA.test(escrita)) leituras = [paraHiragana(escrita)];
  const entradas = escrita ? await consultar(escrita) : [];
  const palavras: PalavraJmdict[] = [];
  let ambiguo = false;
  for (const leitura of leituras) {
    const daLeitura = entradas.filter((e) => e.formas.some((f) => paraHiragana(f.l) === leitura));
    const daEscrita = daLeitura.filter((e) =>
      e.formas.some((f) => f.e === escrita && paraHiragana(f.l) === leitura)
    );
    if (daEscrita.length > 1) ambiguo = true;
    const achadas = [...daEscrita];
    if (daLeitura.length && (SO_KANA.test(escrita) || !daEscrita.length))
      achadas.push(daLeitura[0]);
    palavras.push(...achadas.map(({ seq }) => ({ seq, leitura })));
  }
  return { palavras: sem(palavras, chavePalavra), ambiguo };
}

export { ehGramaticaPedaco as ehGramatica };

/** Parte da leitura antes do okurigana que a escrita e a leitura têm em comum (行く/いく → い). */
function radical(escrita: string, leitura: string) {
  const [e, l] = [paraHiragana(escrita), paraHiragana(leitura)];
  let comum = 0;
  while (comum < Math.min(e.length, l.length) && e.at(-1 - comum) === l.at(-1 - comum)) comum++;
  return l.slice(0, l.length - comum);
}

/** Termos a consultar, em ordem: forma de dicionário, verbo de origem do potencial, superfície. */
function termosDoPedaco({ base, superficie, classe }: Pedaco) {
  const termos = [base];
  const potencial = classe === '動詞' ? verboDoPotencial(base) : undefined;
  if (potencial) termos.push(potencial);
  if (superficie !== base) termos.push(superficie);
  return termos;
}

/**
 * Liga um pedaço do texto a uma entrada do JMdict pela forma de dicionário (ADR 0005), com o
 * potencial como reserva. Desempata
 * pela leitura do pedaço (no conjugado, só o radical); se nada bate, ficam todas, e a Palavra é a
 * mais frequente. Devolve null para gramática.
 */
export async function casarPedaco(consultar: Consulta, pedaco: Pedaco) {
  if (ehGramaticaPedaco(pedaco)) return null;
  let termo = pedaco.base;
  let entradas: Entrada[] = [];
  for (termo of termosDoPedaco(pedaco)) {
    entradas = await consultar(termo);
    if (entradas.length) break;
  }
  const conjugado = pedaco.superficie !== termo;
  const leitura = paraHiragana(pedaco.leitura);
  const bate = (escrita: string, l: string) =>
    !leitura || (conjugado ? leitura.startsWith(radical(escrita, l)) : paraHiragana(l) === leitura);

  const porLeitura: PalavraJmdict[] = [];
  const todas: PalavraJmdict[] = [];
  for (const { seq, formas } of entradas) {
    const doTermo = formas.filter((f) => f.e === termo || f.l === termo);
    const certa = doTermo.find((f) => bate(termo, f.l));
    if (certa) porLeitura.push({ seq, leitura: paraHiragana(certa.l) });
    if (doTermo.length) todas.push({ seq, leitura: paraHiragana(doTermo[0].l) });
  }
  const candidatas = sem(porLeitura.length ? porLeitura : todas, chavePalavra);
  return { palavra: candidatas[0] as PalavraJmdict | undefined, candidatas };
}
