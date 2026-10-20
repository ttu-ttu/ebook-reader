/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Formato do dicionário do app (ADR 0004). O script tools/preparar-dicionario.ts roda este
// arquivo direto no Node (que só remove os tipos), por isso ele não importa nada.

export const FORMATO = 1;
// Blocos pequenos: ler um bloco custa pelo tamanho dele (R3: 256 entradas = 54 KB ≈ 3 ms no PC).
export const TAMANHO_BLOCO = 64;
// Poucos registros: gravar no IndexedDB custa por registro (R3: 107 mil registros ≈ 30 s no PC).
export const TERMOS_POR_BLOCO = 512;

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
  /** Primeiro termo de cada bloco do índice, em ordem; o bloco de um termo sai por busca binária. */
  limitesIndice: string[];
}

/** Termo → ids das entradas, para um trecho dos termos em ordem. */
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

/** Número do bloco do índice onde o termo estaria; -1 se vem antes de todos. */
export function blocoDoTermo(limites: string[], termo: string) {
  let [baixo, alto] = [0, limites.length - 1];
  let achado = -1;
  while (baixo <= alto) {
    const meio = (baixo + alto) >> 1;
    if (limites[meio] <= termo) {
      achado = meio;
      baixo = meio + 1;
    } else {
      alto = meio - 1;
    }
  }
  return achado;
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
  indice: BlocoIndice[];
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
    entradas.push({ id: 0, seq, formas, sentidos });
  }
  // Pela leitura: os homófonos (こう tem 51 entradas) ficam em poucos blocos.
  entradas.sort((a, b) => {
    const [la, lb] = [a.formas[0].l, b.formas[0].l];
    return la < lb ? -1 : la > lb ? 1 : a.seq - b.seq;
  });
  entradas.forEach((entrada, id) => {
    entrada.id = id;
    idPorSeq.set(entrada.seq, id);
  });

  const idsPorTermo = new Map<string, number[]>();
  const indexar = (termo: string, id: number) => {
    const ids = idsPorTermo.get(termo);
    if (!ids) idsPorTermo.set(termo, [id]);
    else if (!ids.includes(id)) ids.push(id);
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

  const termosEmOrdem = [...idsPorTermo.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const indice: BlocoIndice[] = [];
  const limitesIndice: string[] = [];
  for (let i = 0; i < termosEmOrdem.length; i += TERMOS_POR_BLOCO) {
    const trecho = termosEmOrdem.slice(i, i + TERMOS_POR_BLOCO);
    limitesIndice.push(trecho[0]);
    indice.push(Object.fromEntries(trecho.map((termo) => [termo, idsPorTermo.get(termo)!])));
  }

  return {
    cabecalho: {
      formato: FORMATO,
      versao: fontes.versao,
      fontes: fontes.fontes,
      entradas: entradas.length,
      blocos: Math.ceil(entradas.length / TAMANHO_BLOCO),
      limitesIndice
    },
    entradas,
    indice
  };
}

// Arquivo: uma linha JSON por registro (lido em fluxo no aparelho). A primeira é o cabeçalho;
// depois ["e", bloco, entradas] e ["i", bloco, termos].
export type LinhaArquivo = ['e', number, Entrada[]] | ['i', number, BlocoIndice];

export function* linhasDoArquivo({ cabecalho, entradas, indice }: Preparado): Generator<string> {
  yield JSON.stringify(cabecalho);
  for (let i = 0; i < entradas.length; i += TAMANHO_BLOCO) {
    yield JSON.stringify(['e', i / TAMANHO_BLOCO, entradas.slice(i, i + TAMANHO_BLOCO)]);
  }
  for (const [i, bloco] of indice.entries()) yield JSON.stringify(['i', i, bloco]);
}

export function lerLinha(linha: string): LinhaArquivo {
  return JSON.parse(linha);
}

/**
 * Tipo, número do bloco e o texto JSON do valor, sem fazer o parse do valor: o aparelho grava o texto e só
 * lê o bloco na consulta (preparação mais rápida).
 */
export function separarLinha(linha: string) {
  const fimChave = linha.indexOf(',', 5);
  return {
    tipo: linha[2] as 'e' | 'i',
    bloco: Number(linha.slice(5, fimChave)),
    json: linha.slice(fimChave + 1, -1)
  };
}

export function lerArquivo(linhas: Iterable<string>) {
  const [primeira, ...resto] = linhas;
  const cabecalho: Cabecalho = JSON.parse(primeira);
  if (cabecalho.formato !== FORMATO) throw new Error(`Formato ${cabecalho.formato} desconhecido`);
  const blocosEntradas: [number, Entrada[]][] = [];
  const blocosIndice: [number, BlocoIndice][] = [];
  for (const linha of resto) {
    const registro = lerLinha(linha);
    if (registro[0] === 'e') blocosEntradas.push([registro[1], registro[2]]);
    else blocosIndice.push([registro[1], registro[2]]);
  }
  return { cabecalho, blocosEntradas, blocosIndice };
}
