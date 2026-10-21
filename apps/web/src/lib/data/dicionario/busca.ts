/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { Entrada } from './formato';
import { paraHiragana, type Pedaco } from './tokenizador';

// Busca da palavra tocada: seleção híbrida (ADR 0003) e deflexão pela forma de dicionário do
// tokenizador (ADR 0005). O tokenizador decide onde a palavra começa (o pedaço tocado); a busca
// decide onde termina: o trecho mais longo de pedaços inteiros cujo último pedaço, na forma de
// dicionário, existe no dicionário (気|が|つい|た → 気がつく). Regras próprias de reserva cobrem o
// que o IPADIC devolve fora do JMdict. Implementação própria (o Yomitan é GPL).

/** Entradas cuja escrita ou leitura é exatamente o termo, da mais frequente para a menos. */
export type Consulta = (termo: string) => Promise<Entrada[]>;

export interface Selecao {
  /** Pedaços que formam o termo consultado. */
  primeiro: number;
  ultimo: number;
  /** Último pedaço da forma conjugada (auxiliares depois do verbo ou adjetivo). */
  fimConjugado: number;
  /** Posição no texto (em unidades de string do JS) do que fica selecionado: [inicio, fim). */
  inicio: number;
  fim: number;
  /** Texto selecionado, na forma em que aparece (vai em <b> na Frase da carta). */
  texto: string;
  /** Forma de dicionário consultada; sem entradas, a do tokenizador para o trecho. */
  termo: string;
  entradas: Entrada[];
  /** Partícula, auxiliar etc.: o painel mostra "gramática · fora da cobertura" (ADR 0007). */
  gramatica: boolean;
}

const MAX_PEDACOS = 6;
const MAX_CARACTERES = 14;

// O IPADIC dá a forma potencial como verbo próprio (会える, 書ける), que o JMdict não tem.
export const POTENCIAL: Record<string, string> = {
  える: 'う',
  ける: 'く',
  げる: 'ぐ',
  せる: 'す',
  てる: 'つ',
  ねる: 'ぬ',
  べる: 'ぶ',
  める: 'む',
  れる: 'る'
};

const JAPONES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆]/u;
// O alongamento (すごーい) sai como pedaço próprio e faz parte da palavra.
const TEXTO = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ー]/u;
const KANA = '\\p{Script=Hiragana}\\p{Script=Katakana}';
const ALONGAMENTO = new RegExp(`(?<=[${KANA}])ー+(?=[${KANA}])`, 'gu');
const CLASSES_GRAMATICA = new Set(['助詞', '助動詞', '記号', 'フィラー', 'その他', '接頭詞']);

/** Verbo de origem de um potencial do IPADIC (会える → 会う); undefined se não é potencial. */
export function verboDoPotencial(base: string) {
  const fim = POTENCIAL[base.slice(-2)];

  return fim && base.length > 2 ? base.slice(0, -2) + fim : undefined;
}

/**
 * Reservas para um termo que não está no dicionário: o verbo do potencial, sem o alongamento
 * (すごーい → すごい), sem o っ de ênfase no fim (ねっ → ね) e em hiragana (カワイイ → かわいい).
 */
export function termosDeReserva(termo: string, ehVerbo: boolean) {
  const reservas: string[] = [];
  const potencial = ehVerbo ? verboDoPotencial(termo) : undefined;

  if (potencial) reservas.push(potencial);

  const semAlongamento = termo.replace(ALONGAMENTO, '');
  const semTsu = termo.replace(/[っッ]+$/u, '');

  for (const variante of [termo, semAlongamento, semTsu]) {
    reservas.push(variante, paraHiragana(variante));
  }

  return reservas.filter((reserva) => reserva && reserva !== termo);
}

function ehPontuacao(pedaco: Pedaco) {
  return pedaco.classe === '記号' || !TEXTO.test(pedaco.superficie);
}

export function ehGramaticaPedaco({ classe, subclasse, superficie }: Pedaco) {
  return (
    CLASSES_GRAMATICA.has(classe) ||
    subclasse === '非自立' ||
    (classe === '動詞' && subclasse === '接尾') ||
    !JAPONES.test(superficie)
  );
}

const colado = (anterior: Pedaco, pedaco: Pedaco) =>
  anterior.inicio + anterior.superficie.length === pedaco.inicio;

/** Termos a consultar para os pedaços primeiro..ultimo, na ordem de preferência. */
export function termosDoIntervalo(pedacos: Pedaco[], primeiro: number, ultimo: number) {
  const antes = pedacos
    .slice(primeiro, ultimo)
    .map((pedaco) => pedaco.superficie)
    .join('');
  const final = pedacos[ultimo];
  const principais = [antes + final.base, antes + final.superficie];
  const termos = [
    ...principais,
    ...principais.flatMap((termo) => termosDeReserva(termo, final.classe === '動詞'))
  ];

  return [...new Set(termos)];
}

/** Último pedaço do intervalo que ainda cabe numa palavra: sem pontuação, sem espaço, curto. */
function ultimoPossivel(pedacos: Pedaco[], primeiro: number) {
  let ultimo = primeiro;
  let caracteres = pedacos[primeiro].superficie.length;

  while (ultimo + 1 < pedacos.length && ultimo + 1 - primeiro < MAX_PEDACOS) {
    const proximo = pedacos[ultimo + 1];

    if (ehPontuacao(proximo) || !colado(pedacos[ultimo], proximo)) break;

    caracteres += proximo.superficie.length;

    if (caracteres > MAX_CARACTERES) break;

    ultimo += 1;
  }

  return ultimo;
}

const conjugavel = (pedaco: Pedaco) => pedaco.classe === '動詞' || pedaco.classe === '形容詞';

/**
 * O pedaço é flexão do anterior: auxiliar (た, ない, ず), verbo sufixo (せる, れる), て/で, ou verbo
 * auxiliar depois de て (いる, くる, しまう, あげる). Um verbo composto (読み|終わる) não é flexão.
 */
function ehFlexao(anterior: Pedaco, pedaco: Pedaco) {
  const depoisDeTe = anterior.classe === '助詞' && /^[てで]$/.test(anterior.superficie);

  return (
    pedaco.classe === '助動詞' ||
    (pedaco.classe === '動詞' && pedaco.subclasse === '接尾') ||
    // O IPADIC corta o causativo-passivo curto em 読ま|さ|れ|た.
    (pedaco.classe === '動詞' && pedaco.superficie === 'さ' && pedaco.base === 'する') ||
    (pedaco.classe === '助詞' &&
      pedaco.subclasse === '接続助詞' &&
      /^(て|で|ちゃ|じゃ)$/.test(pedaco.superficie)) ||
    (pedaco.classe === '動詞' &&
      pedaco.subclasse === '非自立' &&
      (depoisDeTe || /^[てで]/.test(pedaco.superficie)))
  );
}

/**
 * O trecho é um verbo ou adjetivo mais só flexão (知ら|ず, 急い|で, 信じ|られ|ない, 持っ|て|くる).
 * O JMdict tem algumas dessas formas como expressão; a palavra a estudar é o verbo (R5/V1.2).
 */
function soFlexao(pedacos: Pedaco[], primeiro: number, ultimo: number) {
  if (ultimo === primeiro || !conjugavel(pedacos[primeiro])) return false;

  for (let k = primeiro + 1; k <= ultimo; k += 1) {
    if (!ehFlexao(pedacos[k - 1], pedacos[k])) return false;
  }

  return true;
}

/** Auxiliares que fazem parte da forma conjugada de um verbo ou adjetivo (食べ|させ|られ|た). */
function fimDaFormaConjugada(pedacos: Pedaco[], ultimo: number) {
  if (!conjugavel(pedacos[ultimo])) return ultimo;

  let fim = ultimo;

  while (
    fim + 1 < pedacos.length &&
    colado(pedacos[fim], pedacos[fim + 1]) &&
    ehFlexao(pedacos[fim], pedacos[fim + 1])
  ) {
    fim += 1;
  }

  return fim;
}

function montar(
  pedacos: Pedaco[],
  primeiro: number,
  ultimo: number,
  termo: string,
  entradas: Entrada[]
): Selecao {
  const fimConjugado = entradas.length ? fimDaFormaConjugada(pedacos, ultimo) : ultimo;
  const inicio = pedacos[primeiro].inicio;
  const fim = pedacos[fimConjugado].inicio + pedacos[fimConjugado].superficie.length;
  const texto = pedacos
    .slice(primeiro, fimConjugado + 1)
    .map((pedaco) => pedaco.superficie)
    .join('');

  return {
    primeiro,
    ultimo,
    fimConjugado,
    inicio,
    fim,
    texto,
    termo,
    entradas,
    gramatica: primeiro === ultimo && ehGramaticaPedaco(pedacos[primeiro])
  };
}

/** Consulta exatamente os pedaços primeiro..ultimo (as setas ‹ › do painel). */
export async function selecionarIntervalo(
  consultar: Consulta,
  pedacos: Pedaco[],
  primeiro: number,
  ultimo: number
) {
  for (const termo of termosDoIntervalo(pedacos, primeiro, ultimo)) {
    const entradas = await consultar(termo);

    if (entradas.length) return montar(pedacos, primeiro, ultimo, termo, entradas);
  }

  return montar(pedacos, primeiro, ultimo, termosDoIntervalo(pedacos, primeiro, ultimo)[0], []);
}

/**
 * Palavra no toque: começa no pedaço tocado e termina no trecho mais longo que está no
 * dicionário. Sem nada no dicionário, fica o pedaço tocado. null na pontuação e fora do texto.
 */
export async function selecionar(consultar: Consulta, pedacos: Pedaco[], posicao: number) {
  const tocado = pedacos.findIndex(
    (pedaco) => pedaco.inicio <= posicao && posicao < pedaco.inicio + pedaco.superficie.length
  );

  if (tocado < 0 || ehPontuacao(pedacos[tocado])) return null;

  for (let ultimo = ultimoPossivel(pedacos, tocado); ultimo >= tocado; ultimo -= 1) {
    if (soFlexao(pedacos, tocado, ultimo)) continue;

    for (const termo of termosDoIntervalo(pedacos, tocado, ultimo)) {
      const entradas = await consultar(termo);

      if (entradas.length) return montar(pedacos, tocado, ultimo, termo, entradas);
    }
  }

  return montar(pedacos, tocado, tocado, pedacos[tocado].base, []);
}

/** Seta ‹ (delta -1) encurta e › (delta +1) alonga a seleção em um pedaço. */
export async function ajustarSelecao(
  consultar: Consulta,
  pedacos: Pedaco[],
  selecao: Selecao,
  delta: -1 | 1
) {
  const ultimo = selecao.ultimo + delta;

  if (ultimo < selecao.primeiro || ultimo >= pedacos.length) return selecao;
  if (
    delta > 0 &&
    (ehPontuacao(pedacos[ultimo]) || !colado(pedacos[ultimo - 1], pedacos[ultimo]))
  ) {
    return selecao;
  }

  return selecionarIntervalo(consultar, pedacos, selecao.primeiro, ultimo);
}
