/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// A Frase da carta (ESCOPO "Cards"; GLOSSARY "Frase"): do último 。！？ (ou começo do parágrafo) até
// o próximo, sem cortar dentro de 「」 e sem o furigana do EPUB (o texto chega sem <rt>). Acima de
// ~150 caracteres, é cortada perto da palavra.

export interface FraseNoTexto {
  frase: string;
  /** Posição da palavra dentro da frase: [inicio, fim). */
  inicio: number;
  fim: number;
  /** Posição da frase no parágrafo (antes do corte por tamanho). */
  inicioNoTexto: number;
  fimNoTexto: number;
}

const FIM_DE_FRASE = new Set(['。', '！', '？', '!', '?']);
const ABRE = new Set(['「', '『', '（', '(', '【', '〈', '《']);
const FECHA = new Set(['」', '』', '）', ')', '】', '〉', '》']);
const LIMITE = 150;

/** Intervalos [inicio, fim) das frases do parágrafo, sem os espaços das pontas. */
export function frasesDoTexto(texto: string) {
  const frases: [number, number][] = [];
  let profundidade = 0;
  let comeco = 0;

  const fechar = (fim: number) => {
    let [a, b] = [comeco, fim];

    while (a < b && /\s/.test(texto[a])) a += 1;
    while (b > a && /\s/.test(texto[b - 1])) b -= 1;
    if (b > a) frases.push([a, b]);
    comeco = fim;
  };

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];

    if (ABRE.has(c)) profundidade += 1;
    else if (FECHA.has(c)) profundidade = Math.max(0, profundidade - 1);
    else if (profundidade === 0 && FIM_DE_FRASE.has(c)) {
      // !? seguidos fecham juntos (なに！？).
      while (i + 1 < texto.length && FIM_DE_FRASE.has(texto[i + 1])) i += 1;
      fechar(i + 1);
    }
  }

  fechar(texto.length);

  return frases;
}

function indiceDaFrase(frases: [number, number][], posicao: number) {
  const achada = frases.findIndex(([, fim]) => posicao < fim);

  return achada < 0 ? frases.length - 1 : achada;
}

export function fraseEm(texto: string, inicio: number, fim: number): FraseNoTexto {
  const frases = frasesDoTexto(texto);
  const [a, b] = frases[indiceDaFrase(frases, inicio)] ?? [0, texto.length];
  // A palavra pode passar do fim da frase (seleção alongada pelas setas).
  const fimDaFrase = Math.max(b, fim);

  if (fimDaFrase - a <= LIMITE) {
    return {
      frase: texto.slice(a, fimDaFrase),
      inicio: inicio - a,
      fim: fim - a,
      inicioNoTexto: a,
      fimNoTexto: fimDaFrase
    };
  }

  // Corte perto da palavra: uma janela de ~150 caracteres em volta dela, que começa e termina
  // num 、 quando há um na janela.
  const sobra = Math.max(0, LIMITE - 2 - (fim - inicio));
  let corteA = Math.max(a, inicio - Math.floor(sobra / 2));
  let corteB = Math.min(fimDaFrase, corteA + LIMITE - 2);

  corteA = Math.max(a, Math.min(corteA, corteB - (LIMITE - 2)));

  const virgulaA = texto.indexOf('、', corteA);

  if (corteA > a && virgulaA >= 0 && virgulaA < inicio) corteA = virgulaA + 1;

  const virgulaB = texto.lastIndexOf('、', corteB - 1);

  if (corteB < fimDaFrase && virgulaB >= fim) corteB = virgulaB + 1;

  const prefixo = corteA > a ? '…' : '';
  const sufixo = corteB < fimDaFrase ? '…' : '';

  return {
    frase: prefixo + texto.slice(corteA, corteB) + sufixo,
    inicio: inicio - corteA + prefixo.length,
    fim: fim - corteA + prefixo.length,
    inicioNoTexto: a,
    fimNoTexto: fimDaFrase
  };
}

/** Sentence: a frase com a palavra entre <b> e </b> na forma em que aparece (CARDS.md). */
export function comNegrito({ frase, inicio, fim }: FraseNoTexto) {
  return `${frase.slice(0, inicio)}<b>${frase.slice(inicio, fim)}</b>${frase.slice(fim)}`;
}

/**
 * Frase anterior e seguinte, só como contexto para o Gemini (R5): no mesmo parágrafo, ou a última
 * do parágrafo anterior e a primeira do seguinte.
 */
export function contextoDaFrase(
  texto: string,
  frase: FraseNoTexto,
  paragrafoAnterior = '',
  paragrafoSeguinte = ''
) {
  const frases = frasesDoTexto(texto);
  const indice = indiceDaFrase(frases, frase.inicioNoTexto);
  const trecho = ([a, b]: [number, number], de: string) => de.slice(a, b);
  const anteriores = frasesDoTexto(paragrafoAnterior);
  const seguintes = frasesDoTexto(paragrafoSeguinte);

  let antes = '';
  let depois = '';

  if (indice > 0) antes = trecho(frases[indice - 1], texto);
  else if (anteriores.length) antes = trecho(anteriores[anteriores.length - 1], paragrafoAnterior);

  const ultimaDaFrase = indiceDaFrase(frases, Math.max(frase.inicioNoTexto, frase.fimNoTexto - 1));

  if (ultimaDaFrase + 1 < frases.length) depois = trecho(frases[ultimaDaFrase + 1], texto);
  else if (seguintes.length) depois = trecho(seguintes[0], paragrafoSeguinte);

  return { antes, depois };
}
