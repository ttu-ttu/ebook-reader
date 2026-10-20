/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Formato do dicionário do app (ADR 0004). O script tools/preparar-dicionario.ts roda este
// arquivo direto no Node (que só remove os tipos), por isso ele não importa nada.

export const FORMATO = 1;
export const TAMANHO_BLOCO = 256;

/** Pedaço do furigana: texto sem leitura (kana) ou [kanji, leitura]. */
export type PedacoFurigana = string | [string, string];

export interface Forma {
  /** Escrita; igual à leitura nas palavras só em kana. */
  e: string;
  /** Leitura em kana. */
  l: string;
  /** Posição no JPDB desta escrita com esta leitura. */
  f?: number;
  /** Posição no JPDB desta palavra quando aparece escrita em kana. */
  fk?: number;
  /** Furigana do JmdictFurigana, só quando não cobre a escrita inteira. */
  fu?: PedacoFurigana[];
}

export interface Sentido {
  /** Etiquetas do JMdict (classe gramatical, uso). */
  t: string[];
  /** Glosas em inglês. */
  g: string[];
}

export interface Entrada {
  /** Posição no arquivo; o bloco é id / TAMANHO_BLOCO. */
  id: number;
  /** Número da entrada no JMdict (ADR 0008). */
  seq: number;
  formas: Forma[];
  sentidos: Sentido[];
}

export interface Cabecalho {
  formato: number;
  versao: string;
  fontes: Record<string, string>;
  entradas: number;
  blocos: number;
  chaves: number;
}

/** Termo → ids das entradas, para todos os termos que começam pela chave do bloco. */
export type BlocoIndice = Record<string, number[]>;

// Linhas dos arquivos Yomitan e do JmdictFurigana.
export type LinhaTermo = [string, string, string, string, number, unknown[], number, string];
export type LinhaFrequencia = [
  string,
  string,
  (
    | { value: number; displayValue?: string }
    | { reading: string; frequency: { value: number; displayValue?: string } }
  )
];
export interface LinhaFurigana {
  text: string;
  reading: string;
  furigana: { ruby: string; rt?: string }[];
}

/** Chave do bloco do índice: os dois primeiros caracteres do termo. */
export function chaveDoBloco(termo: string) {
  return Array.from(termo).slice(0, 2).join('');
}

/** Glosas em inglês de uma linha do JMdict do Yomitan (ignora notas, referências e formas). */
export function glosasDe(definicoes: unknown[]): string[] {
  const glosas: string[] = [];
  const textos = (no: unknown): string => {
    if (typeof no === 'string') return no;
    if (Array.isArray(no)) return no.map(textos).join('');
    if (no && typeof no === 'object') return textos((no as { content?: unknown }).content);
    return '';
  };
  const visitar = (no: unknown) => {
    if (Array.isArray(no)) {
      no.forEach(visitar);
      return;
    }
    if (!no || typeof no !== 'object') return;
    const { data, content } = no as { data?: { content?: string }; content?: unknown };
    if (data?.content === 'glossary') {
      const itens = Array.isArray(content) ? content : [content];
      for (const item of itens) {
        const texto = textos(item).trim();
        if (texto) glosas.push(texto);
      }
      return;
    }
    visitar(content);
  };
  for (const definicao of definicoes) {
    if (typeof definicao === 'string') glosas.push(definicao);
    else visitar(definicao);
  }
  return glosas;
}

export interface Preparado {
  cabecalho: Cabecalho;
  entradas: Entrada[];
  indice: Map<string, BlocoIndice>;
}

export function prepararDicionario(fontes: {
  termos: Iterable<LinhaTermo>;
  frequencias: Iterable<LinhaFrequencia>;
  furiganas: Iterable<LinhaFurigana>;
  versao: string;
  fontes: Record<string, string>;
}): Preparado {
  const porSeq = new Map<number, LinhaTermo[]>();
  const redirecionamentos: LinhaTermo[] = [];
  for (const linha of fontes.termos) {
    const seq = linha[6];
    if (seq < 0) {
      redirecionamentos.push(linha);
      continue;
    }
    const linhas = porSeq.get(seq);
    if (linhas) linhas.push(linha);
    else porSeq.set(seq, [linha]);
  }

  const freqEscrita = new Map<string, number>();
  const freqKana = new Map<string, number>();
  const menor = (mapa: Map<string, number>, chave: string, valor: number) => {
    const atual = mapa.get(chave);
    if (atual === undefined || valor < atual) mapa.set(chave, valor);
  };
  // No JPDB, ㋕ marca a frequência da palavra (escrita + leitura) quando aparece escrita em kana.
  for (const [termo, , dado] of fontes.frequencias) {
    if ('reading' in dado) {
      const emKana = dado.frequency.displayValue?.endsWith('㋕');
      menor(emKana ? freqKana : freqEscrita, `${termo}|${dado.reading}`, dado.frequency.value);
    } else {
      menor(freqKana, `${termo}|${termo}`, dado.value);
    }
  }

  const furigana = new Map<string, PedacoFurigana[]>();
  for (const { text, reading, furigana: pedacos } of fontes.furiganas) {
    const inteiro = pedacos.length === 1 && pedacos[0].ruby === text;
    if (inteiro || !pedacos.some((p) => p.rt)) continue;
    furigana.set(
      `${text}|${reading}`,
      pedacos.map((p) => (p.rt ? [p.ruby, p.rt] : p.ruby))
    );
  }

  const entradas: Entrada[] = [];
  const idPorSeq = new Map<number, number>();
  for (const [seq, linhas] of porSeq) {
    linhas.sort((a, b) => b[4] - a[4]);
    const formas: Forma[] = [];
    const vistasFormas = new Set<string>();
    const sentidos: Sentido[] = [];
    const vistosSentidos = new Set<string>();
    for (const [escrita, leituraBruta, etiquetas, , , definicoes] of linhas) {
      const leitura = leituraBruta || escrita;
      const chave = `${escrita}|${leitura}`;
      if (!vistasFormas.has(chave)) {
        vistasFormas.add(chave);
        const forma: Forma = { e: escrita, l: leitura };
        const f = freqEscrita.get(chave);
        const fk = freqKana.get(chave);
        const fu = escrita === leitura ? undefined : furigana.get(chave);
        if (f !== undefined) forma.f = f;
        if (fk !== undefined) forma.fk = fk;
        if (fu) forma.fu = fu;
        formas.push(forma);
      }
      if (etiquetas === 'forms') continue;
      const g = glosasDe(definicoes);
      if (!g.length) continue;
      const t = etiquetas.split(' ').filter((x) => x && !/^\d+$/.test(x));
      const chaveSentido = JSON.stringify([t, g]);
      if (vistosSentidos.has(chaveSentido)) continue;
      vistosSentidos.add(chaveSentido);
      sentidos.push({ t, g });
    }
    idPorSeq.set(seq, entradas.length);
    entradas.push({ id: entradas.length, seq, formas, sentidos });
  }

  const indice = new Map<string, BlocoIndice>();
  const indexar = (termo: string, id: number) => {
    const chave = chaveDoBloco(termo);
    let bloco = indice.get(chave);
    if (!bloco) indice.set(chave, (bloco = {}));
    const ids = (bloco[termo] ??= []);
    if (!ids.includes(id)) ids.push(id);
  };
  for (const entrada of entradas) {
    for (const { e, l } of entrada.formas) {
      indexar(e, entrada.id);
      indexar(l, entrada.id);
    }
  }
  for (const [escrita, , , , , , seq] of redirecionamentos) {
    const id = idPorSeq.get(-seq);
    if (id !== undefined) indexar(escrita, id);
  }

  return {
    cabecalho: {
      formato: FORMATO,
      versao: fontes.versao,
      fontes: fontes.fontes,
      entradas: entradas.length,
      blocos: Math.ceil(entradas.length / TAMANHO_BLOCO),
      chaves: indice.size
    },
    entradas,
    indice
  };
}

// Arquivo: uma linha JSON por registro (lido em fluxo no aparelho). A primeira é o cabeçalho;
// depois ["e", bloco, entradas] e ["i", chave, termos].
export type LinhaArquivo = ['e', number, Entrada[]] | ['i', string, BlocoIndice];

export function* linhasDoArquivo({ cabecalho, entradas, indice }: Preparado): Generator<string> {
  yield JSON.stringify(cabecalho);
  for (let i = 0; i < entradas.length; i += TAMANHO_BLOCO) {
    yield JSON.stringify(['e', i / TAMANHO_BLOCO, entradas.slice(i, i + TAMANHO_BLOCO)]);
  }
  for (const [chave, bloco] of indice) yield JSON.stringify(['i', chave, bloco]);
}

export function lerLinha(linha: string): LinhaArquivo {
  return JSON.parse(linha);
}

export function lerArquivo(linhas: Iterable<string>) {
  const [primeira, ...resto] = linhas;
  const cabecalho: Cabecalho = JSON.parse(primeira);
  if (cabecalho.formato !== FORMATO) throw new Error(`Formato ${cabecalho.formato} desconhecido`);
  const blocosEntradas: [number, Entrada[]][] = [];
  const blocosIndice: [string, BlocoIndice][] = [];
  for (const linha of resto) {
    const registro = lerLinha(linha);
    if (registro[0] === 'e') blocosEntradas.push([registro[1], registro[2]]);
    else blocosIndice.push([registro[1], registro[2]]);
  }
  return { cabecalho, blocosEntradas, blocosIndice };
}
