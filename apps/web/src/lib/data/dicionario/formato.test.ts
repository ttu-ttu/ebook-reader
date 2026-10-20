/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  chaveDoBloco,
  glosasDe,
  lerArquivo,
  linhasDoArquivo,
  prepararDicionario,
  type LinhaFrequencia,
  type LinhaFurigana,
  type LinhaTermo
} from './formato';

const lista = (...itens: string[]) => ({
  type: 'structured-content',
  content: {
    tag: 'ul',
    data: { content: 'glossary' },
    content: itens.map((content) => ({ tag: 'li', content }))
  }
});

// Linhas no formato do JMdict_english do Yomitan: uma por sentido e por escrita.
const termos: LinhaTermo[] = [
  [
    '分かる',
    'わかる',
    '1 v5r vi uk',
    'v5',
    1999800,
    [lista('to understand', 'to grasp')],
    1606560,
    '⭐ ichi'
  ],
  [
    '分かる',
    'わかる',
    '2 v5r vi uk',
    'v5',
    1999799,
    [lista('to become clear')],
    1606560,
    '⭐ ichi'
  ],
  [
    '分かる',
    'わかる',
    'forms',
    'v5',
    1999797,
    [{ type: 'structured-content', content: { tag: 'table', data: { content: 'formsTable' } } }],
    1606560,
    ''
  ],
  [
    '解る',
    'わかる',
    '1 v5r vi uk',
    'v5',
    999800,
    [lista('to understand', 'to grasp')],
    1606560,
    ''
  ],
  [
    '判る',
    '',
    '',
    'v5',
    -5010000,
    [{ type: 'structured-content', content: ['⟶', { tag: 'a', content: '分かる' }] }],
    -1606560,
    ''
  ],
  [
    '何',
    'なに',
    '1 pn',
    '',
    1999800,
    [
      'what',
      {
        type: 'structured-content',
        content: { tag: 'ul', data: { content: 'notes' }, content: 'nota' }
      }
    ],
    1577100,
    ''
  ],
  ['何', 'なん', '1 pn', '', 999800, ['what (before t, d, n)'], 2846738, ''],
  ['これ', 'これ', '1 pn', '', 999800, ['this'], 1628500, ''],
  ['する', 'する', '1 vs-i', '', 999800, ['to do'], 1157170, ''],
  ['掏る', 'する', '1 v5r', 'v5', 999800, ['to pickpocket'], 1567440, '']
];

const frequencias: LinhaFrequencia[] = [
  ['分かる', 'freq', { reading: 'わかる', frequency: { value: 465, displayValue: '465' } }],
  ['分かる', 'freq', { reading: 'わかる', frequency: { value: 455, displayValue: '455㋕' } }],
  ['わかる', 'freq', { value: 455, displayValue: '455㋕' }],
  ['何', 'freq', { reading: 'なに', frequency: { value: 72, displayValue: '72' } }],
  ['何', 'freq', { reading: 'なに', frequency: { value: 493, displayValue: '493㋕' } }],
  ['何', 'freq', { reading: 'なん', frequency: { value: 101, displayValue: '101' } }],
  ['する', 'freq', { value: 11, displayValue: '11㋕' }],
  ['掏る', 'freq', { reading: 'する', frequency: { value: 74469, displayValue: '74469' } }],
  ['掏る', 'freq', { reading: 'する', frequency: { value: 60000, displayValue: '60000㋕' } }]
];

const furiganas: LinhaFurigana[] = [
  { text: '分かる', reading: 'わかる', furigana: [{ ruby: '分', rt: 'わ' }, { ruby: 'かる' }] },
  { text: '何', reading: 'なに', furigana: [{ ruby: '何', rt: 'なに' }] }
];

const preparar = () =>
  prepararDicionario({ termos, frequencias, furiganas, versao: 'teste', fontes: { JMdict: 'x' } });

describe('glosasDe', () => {
  it('pega só as listas de glosas e os textos simples', () => {
    expect(glosasDe([lista('a', 'b'), 'c'])).toEqual(['a', 'b', 'c']);
    expect(
      glosasDe([
        {
          type: 'structured-content',
          content: { tag: 'ul', data: { content: 'notes' }, content: 'x' }
        }
      ])
    ).toEqual([]);
  });

  it('aceita uma glosa única sem lista', () => {
    const umaSo = {
      type: 'structured-content',
      content: { tag: 'ul', data: { content: 'glossary' }, content: { tag: 'li', content: 'only' } }
    };
    expect(glosasDe([umaSo])).toEqual(['only']);
  });
});

describe('prepararDicionario', () => {
  it('junta as escritas de uma entrada do JMdict e tira sentidos repetidos', () => {
    const { entradas } = preparar();
    const wakaru = entradas.find((e) => e.seq === 1606560)!;
    expect(wakaru.formas.map((f) => [f.e, f.l])).toEqual([
      ['分かる', 'わかる'],
      ['解る', 'わかる']
    ]);
    expect(wakaru.sentidos).toEqual([
      { t: ['v5r', 'vi', 'uk'], g: ['to understand', 'to grasp'] },
      { t: ['v5r', 'vi', 'uk'], g: ['to become clear'] }
    ]);
  });

  it('separa leituras que o JMdict separa (何 なに / なん)', () => {
    const { entradas } = preparar();
    expect(entradas.filter((e) => e.formas.some((f) => f.e === '何')).map((e) => e.seq)).toEqual([
      1577100, 2846738
    ]);
  });

  it('põe a frequência JPDB da escrita e a do kana', () => {
    const { entradas } = preparar();
    const nani = entradas.find((e) => e.seq === 1577100)!;
    expect(nani.formas[0]).toMatchObject({ e: '何', l: 'なに', f: 72, fk: 493 });
    const wakaru = entradas.find((e) => e.seq === 1606560)!;
    expect(wakaru.formas[0]).toMatchObject({ f: 465, fk: 455 });
    expect(wakaru.formas[1].f).toBeUndefined();
  });

  it('a frequência em kana é do par escrita + leitura, não só da leitura', () => {
    const { entradas } = preparar();
    expect(entradas.find((e) => e.seq === 1157170)!.formas[0]).toMatchObject({ e: 'する', fk: 11 });
    expect(entradas.find((e) => e.seq === 1567440)!.formas[0]).toMatchObject({
      f: 74469,
      fk: 60000
    });
  });

  it('guarda o furigana só quando não cobre a palavra inteira', () => {
    const { entradas } = preparar();
    expect(entradas.find((e) => e.seq === 1606560)!.formas[0].fu).toEqual([['分', 'わ'], 'かる']);
    expect(entradas.find((e) => e.seq === 1577100)!.formas[0].fu).toBeUndefined();
  });

  it('indexa escritas, leituras e redirecionamentos', () => {
    const { entradas, indice } = preparar();
    const id = entradas.find((e) => e.seq === 1606560)!.id;
    expect(indice.get(chaveDoBloco('分かる'))!['分かる']).toEqual([id]);
    expect(indice.get(chaveDoBloco('わかる'))!['わかる']).toEqual([id]);
    expect(indice.get(chaveDoBloco('判る'))!['判る']).toEqual([id]);
    const nani = entradas.filter((e) => e.formas.some((f) => f.e === '何')).map((e) => e.id);
    expect(indice.get('何')!['何']).toEqual(nani);
  });

  it('palavra só em kana tem escrita igual à leitura', () => {
    const { entradas } = preparar();
    expect(entradas.find((e) => e.seq === 1628500)!.formas).toEqual([{ e: 'これ', l: 'これ' }]);
  });
});

describe('chaveDoBloco', () => {
  it('usa os dois primeiros caracteres', () => {
    expect(chaveDoBloco('気がつく')).toBe('気が');
    expect(chaveDoBloco('気')).toBe('気');
    expect(chaveDoBloco('𠮟る')).toBe('𠮟る');
  });
});

describe('arquivo', () => {
  it('lê de volta o que escreveu', () => {
    const prep = preparar();
    const lido = lerArquivo([...linhasDoArquivo(prep)]);
    expect(lido.cabecalho.versao).toBe('teste');
    expect(lido.cabecalho.entradas).toBe(prep.entradas.length);
    expect(lido.blocosEntradas.flatMap(([, v]) => v)).toEqual(prep.entradas);
    expect(new Map(lido.blocosIndice)).toEqual(prep.indice);
  });
});
