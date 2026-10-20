/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { Entrada } from '$lib/data/dicionario/formato';
import { paraHiragana, type Pedaco } from '$lib/data/dicionario/tokenizador';

// Casamento texto ↔ Anki pela entrada do JMdict (ADR 0008): o Card e a palavra do texto são a
// mesma Palavra quando caem na mesma entrada (seq) com a mesma leitura.

/** Palavra do lado do hub: entrada do JMdict + leitura em hiragana. */
export interface PalavraJmdict {
  seq: number;
  leitura: string;
}

/** Entradas cuja escrita ou leitura é o termo, da mais frequente para a menos (como `consultar`). */
export type Consulta = (termo: string) => Promise<Entrada[]>;

export const chavePalavra = ({ seq, leitura }: PalavraJmdict) => `${seq}|${leitura}`;

const JAPONES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆]/u;
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
    const achadas = entradas.filter((e) => e.formas.some((f) => paraHiragana(f.l) === leitura));
    if (achadas.length > 1) ambiguo = true;
    palavras.push(...achadas.map(({ seq }) => ({ seq, leitura })));
  }
  return { palavras: sem(palavras, chavePalavra), ambiguo };
}

const CLASSES_GRAMATICA = new Set(['助詞', '助動詞', '記号', 'フィラー', 'その他']);

/** Partículas, auxiliares, símbolos, 非自立 (ている, こと) e o que não tem kana nem kanji (ADR 0007). */
export function ehGramatica({ classe, subclasse, superficie }: Pedaco) {
  return CLASSES_GRAMATICA.has(classe) || subclasse === '非自立' || !JAPONES.test(superficie);
}

/** Parte da leitura antes do okurigana que a escrita e a leitura têm em comum (行く/いく → い). */
function radical(escrita: string, leitura: string) {
  const [e, l] = [paraHiragana(escrita), paraHiragana(leitura)];
  let comum = 0;
  while (comum < Math.min(e.length, l.length) && e.at(-1 - comum) === l.at(-1 - comum)) comum++;
  return l.slice(0, l.length - comum);
}

/**
 * Liga um pedaço do texto a uma entrada do JMdict pela forma de dicionário (ADR 0005). Desempata
 * pela leitura do pedaço (no conjugado, só o radical); se nada bate, ficam todas, e a Palavra é a
 * mais frequente. Devolve null para gramática.
 */
export async function casarPedaco(consultar: Consulta, pedaco: Pedaco) {
  if (ehGramatica(pedaco)) return null;
  let termo = pedaco.base;
  let entradas = await consultar(termo);
  if (!entradas.length && pedaco.superficie !== termo) {
    termo = pedaco.superficie;
    entradas = await consultar(termo);
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
