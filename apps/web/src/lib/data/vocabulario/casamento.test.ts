/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { ordenarPorFrequencia } from '$lib/data/dicionario/banco';
import type { Entrada, Forma } from '$lib/data/dicionario/formato';
import type { Pedaco } from '$lib/data/dicionario/tokenizador';
import {
  casarCard,
  casarPedaco,
  chavePalavra,
  ehGramatica,
  indexarAnki,
  leiturasDoCampo,
  noAnki,
  limparCampo,
  type Consulta
} from './casamento';

const SEQ = {
  wakaru: 1606560,
  nani: 1577100,
  iku: 1578850,
  kuru: 1547720,
  kata: 1,
  hou: 2,
  kakeru: 1207610,
  kakeruEscrever: 3,
  biiru: 4,
  nama1: 5,
  nama2: 6,
  taberu: 7,
  sanSufixo: 1005340,
  sanNumero: 1579350,
  au: 8,
  tsukuru: 9,
  naru: 1375610,
  naruRara: 10,
  minna: 1202150
};

const entrada = (seq: number, ...formas: Forma[]): Entrada => ({
  id: seq,
  seq,
  formas,
  sentidos: []
});

const entradas: Entrada[] = [
  entrada(
    SEQ.wakaru,
    { e: '分かる', l: 'わかる', f: 300, fk: 40 },
    { e: '判る', l: 'わかる' },
    { e: '解る', l: 'わかる' }
  ),
  entrada(SEQ.nani, { e: '何', l: 'なに', f: 30 }, { e: '何', l: 'なん', f: 20 }),
  entrada(SEQ.iku, { e: '行く', l: 'いく', f: 50 }, { e: '行く', l: 'ゆく', f: 900 }),
  entrada(SEQ.kuru, { e: '来る', l: 'くる', f: 60 }),
  entrada(SEQ.kata, { e: '方', l: 'かた', f: 500 }),
  entrada(SEQ.hou, { e: '方', l: 'ほう', f: 100 }),
  entrada(SEQ.kakeru, { e: '掛ける', l: 'かける', f: 800, fk: 700 }),
  entrada(SEQ.kakeruEscrever, { e: '書ける', l: 'かける', f: 2000, fk: 9000 }),
  entrada(SEQ.biiru, { e: 'ビール', l: 'ビール', f: 3000 }),
  entrada(SEQ.nama1, { e: '生', l: 'なま', f: 1500 }),
  entrada(SEQ.nama2, { e: '生', l: 'なま', f: 4000 }),
  entrada(SEQ.taberu, { e: '食べる', l: 'たべる', f: 200 }),
  entrada(SEQ.sanSufixo, { e: 'さん', l: 'さん', fk: 10 }),
  entrada(SEQ.sanNumero, { e: '三', l: 'さん', f: 100, fk: 5000 }),
  entrada(SEQ.naru, { e: '成る', l: 'なる', f: 400, fk: 20 }),
  entrada(SEQ.naruRara, { e: 'なる', l: 'なる', fk: 9000 }),
  entrada(SEQ.minna, { e: '皆', l: 'みんな', f: 70, fk: 30 }, { e: '皆', l: 'みな', f: 120 }),
  entrada(SEQ.au, { e: '会う', l: 'あう', f: 90 }),
  entrada(SEQ.tsukuru, { e: '作る', l: 'つくる', f: 150 })
];

// Como o banco: escrita ou leitura igual ao termo, da mais frequente para a menos.
const consultar: Consulta = async (termo) =>
  ordenarPorFrequencia(
    entradas.filter((x) => x.formas.some((f) => f.e === termo || f.l === termo)),
    termo
  );

const pedaco = (
  superficie: string,
  base: string,
  leitura: string,
  classe = '動詞',
  subclasse = '自立'
): Pedaco => ({ superficie, base, leitura, classe, subclasse, inicio: 0 });

describe('campos do Anki', () => {
  it('limpa HTML, espaços e o til', () => {
    expect(limparCampo(' <b>何</b>&nbsp;')).toBe('何');
    expect(limparCampo('〜さん')).toBe('さん');
    expect(limparCampo('~さん')).toBe('さん');
  });

  it('separa leituras por ・ e vírgula, em hiragana', () => {
    expect(leiturasDoCampo('なに・なん')).toEqual(['なに', 'なん']);
    expect(leiturasDoCampo('よん、 し')).toEqual(['よん', 'し']);
    expect(leiturasDoCampo('ビール')).toEqual(['びーる']);
    expect(leiturasDoCampo('')).toEqual([]);
  });
});

describe('Card → entrada do JMdict', () => {
  it('casa pela escrita e pela leitura', async () => {
    expect(await casarCard(consultar, '分かる', 'わかる')).toEqual({
      palavras: [{ seq: SEQ.wakaru, leitura: 'わかる' }],
      ambiguo: false
    });
  });

  it('escrita alternativa cai na mesma entrada', async () => {
    const { palavras } = await casarCard(consultar, '判る', 'わかる');
    expect(palavras).toEqual([{ seq: SEQ.wakaru, leitura: 'わかる' }]);
  });

  it('mais de uma leitura no campo vira uma Palavra por leitura', async () => {
    const { palavras } = await casarCard(consultar, '何', 'なに・なん');
    expect(palavras).toEqual([
      { seq: SEQ.nani, leitura: 'なに' },
      { seq: SEQ.nani, leitura: 'なん' }
    ]);
  });

  it('homógrafo com outra leitura: só a entrada da leitura do Card', async () => {
    const { palavras } = await casarCard(consultar, '方', 'ほう');
    expect(palavras).toEqual([{ seq: SEQ.hou, leitura: 'ほう' }]);
  });

  it('mesma escrita e mesma leitura em duas entradas: liga as duas e marca ambíguo', async () => {
    expect(await casarCard(consultar, '生', 'なま')).toEqual({
      palavras: [
        { seq: SEQ.nama1, leitura: 'なま' },
        { seq: SEQ.nama2, leitura: 'なま' }
      ],
      ambiguo: true
    });
  });

  it('Card só em kana fica com as entradas escritas assim, não com os homófonos em kanji', async () => {
    expect(await casarCard(consultar, 'さん', 'さん')).toEqual({
      palavras: [{ seq: SEQ.sanSufixo, leitura: 'さん' }],
      ambiguo: false
    });
  });

  it('Card só em kana também liga a entrada que o texto escolhe para a mesma palavra', async () => {
    const card = await casarCard(consultar, 'なる', 'なる');
    const texto = await casarPedaco(consultar, pedaco('なる', 'なる', 'なる'));
    expect(texto?.palavra).toEqual({ seq: SEQ.naru, leitura: 'なる' });
    expect(card.palavras.map(chavePalavra)).toContain(chavePalavra(texto!.palavra!));
  });

  it('katakana casa com a leitura em katakana', async () => {
    const { palavras } = await casarCard(consultar, 'ビール', 'ビール');
    expect(palavras).toEqual([{ seq: SEQ.biiru, leitura: 'びーる' }]);
  });

  it('leitura vazia em palavra só em kana usa a própria palavra', async () => {
    const { palavras } = await casarCard(consultar, 'わかる', '');
    expect(palavras).toEqual([{ seq: SEQ.wakaru, leitura: 'わかる' }]);
  });

  it('sem entrada com aquela escrita e leitura: nenhuma Palavra', async () => {
    expect((await casarCard(consultar, 'ほげ', 'ほげ')).palavras).toEqual([]);
    expect((await casarCard(consultar, '行く', 'いける')).palavras).toEqual([]);
  });
});

describe('gramática', () => {
  it('partículas, auxiliares, símbolos e 非自立 ficam de fora', () => {
    expect(ehGramatica(pedaco('は', 'は', 'は', '助詞', '係助詞'))).toBe(true);
    expect(ehGramatica(pedaco('た', 'た', 'た', '助動詞', '*'))).toBe(true);
    expect(ehGramatica(pedaco('。', '。', '。', '記号', '句点'))).toBe(true);
    expect(ehGramatica(pedaco('い', 'いる', 'い', '動詞', '非自立'))).toBe(true);
    expect(ehGramatica(pedaco('こと', 'こと', 'こと', '名詞', '非自立'))).toBe(true);
    expect(ehGramatica(pedaco('2024', '2024', '', '名詞', '数'))).toBe(true);
    expect(ehGramatica(pedaco('お', 'お', 'お', '接頭詞', '名詞接続'))).toBe(true);
    expect(ehGramatica(pedaco('せる', 'せる', 'せる', '動詞', '接尾'))).toBe(true);
  });

  it('palavras de conteúdo contam', () => {
    expect(ehGramatica(pedaco('食べ', '食べる', 'たべ'))).toBe(false);
    expect(ehGramatica(pedaco('七', '七', 'なな', '名詞', '数'))).toBe(false);
    expect(ehGramatica(pedaco('さん', 'さん', 'さん', '名詞', '接尾'))).toBe(false);
  });
});

describe('pedaço do texto → entrada do JMdict', () => {
  it('わかる no texto é a mesma Palavra que o 分かる do Anki', async () => {
    const texto = await casarPedaco(consultar, pedaco('わかっ', 'わかる', 'わかっ'));
    const card = await casarCard(consultar, '分かる', 'わかる');
    expect(texto?.palavra).toEqual({ seq: SEQ.wakaru, leitura: 'わかる' });
    expect(chavePalavra(texto!.palavra!)).toBe(chavePalavra(card.palavras[0]));
  });

  it('conjugado: escolhe a leitura pelo radical', async () => {
    const texto = await casarPedaco(consultar, pedaco('行っ', '行く', 'いっ'));
    expect(texto?.palavra).toEqual({ seq: SEQ.iku, leitura: 'いく' });
  });

  it('substantivo homógrafo: escolhe pela leitura do pedaço', async () => {
    const texto = await casarPedaco(consultar, pedaco('方', '方', 'かた', '名詞', '一般'));
    expect(texto?.palavra).toEqual({ seq: SEQ.kata, leitura: 'かた' });
    expect(texto?.candidatas).toHaveLength(1);
  });

  it('leitura irregular que não bate: fica a forma mais frequente', async () => {
    const texto = await casarPedaco(consultar, pedaco('来', '来る', 'き'));
    expect(texto?.palavra).toEqual({ seq: SEQ.kuru, leitura: 'くる' });
  });

  it('só em kana com várias entradas: a mais frequente, com as outras como candidatas', async () => {
    const texto = await casarPedaco(consultar, pedaco('かける', 'かける', 'かける'));
    expect(texto?.palavra).toEqual({ seq: SEQ.kakeru, leitura: 'かける' });
    expect(texto?.candidatas.map((p) => p.seq)).toEqual([SEQ.kakeru, SEQ.kakeruEscrever]);
  });

  it('katakana do texto vira hiragana na leitura', async () => {
    const texto = await casarPedaco(
      consultar,
      pedaco('ビール', 'ビール', 'びーる', '名詞', '一般')
    );
    expect(texto?.palavra).toEqual({ seq: SEQ.biiru, leitura: 'びーる' });
  });

  it('forma potencial que o JMdict não tem cai no verbo de origem', async () => {
    const aeru = await casarPedaco(consultar, pedaco('会え', '会える', 'あえ'));
    expect(aeru?.palavra).toEqual({ seq: SEQ.au, leitura: 'あう' });
    const tsukureru = await casarPedaco(consultar, pedaco('作れる', '作れる', 'つくれる'));
    expect(tsukureru?.palavra).toEqual({ seq: SEQ.tsukuru, leitura: 'つくる' });
  });

  it('fora do dicionário: sem Palavra', async () => {
    const texto = await casarPedaco(consultar, pedaco('ぴえん', 'ぴえん', '', '名詞', '一般'));
    expect(texto).toEqual({ palavra: undefined, candidatas: [] });
  });

  it('gramática não é casada', async () => {
    expect(await casarPedaco(consultar, pedaco('は', 'は', 'は', '助詞', '係助詞'))).toBeNull();
  });
});

describe('texto ↔ Anki pela entrada (ADR 0013)', () => {
  const indiceDe = async (...cards: [string, string][]) =>
    indexarAnki(
      (await Promise.all(cards.map(([w, r]) => casarCard(consultar, w, r)))).flatMap(
        (c) => c.palavras
      )
    );

  it('mesma entrada com outra leitura casa e avisa a leitura do Anki', async () => {
    const indice = await indiceDe(['みんな', 'みんな']);
    const texto = await casarPedaco(consultar, pedaco('皆', '皆', 'みな', '名詞', '代名詞'));
    expect(noAnki(indice, texto!.palavra!)).toEqual({ leituras: ['みんな'], outraLeitura: true });
  });

  it('mesma leitura: casa sem aviso', async () => {
    const indice = await indiceDe(['何', 'なに・なん']);
    const texto = await casarPedaco(consultar, pedaco('何', '何', 'なん', '名詞', '代名詞'));
    expect(noAnki(indice, texto!.palavra!)).toEqual({
      leituras: ['なに', 'なん'],
      outraLeitura: false
    });
  });

  it('homógrafo em outra entrada continua separado', async () => {
    const indice = await indiceDe(['方', 'ほう']);
    const texto = await casarPedaco(consultar, pedaco('方', '方', 'かた', '名詞', '一般'));
    expect(noAnki(indice, texto!.palavra!)).toBeUndefined();
  });
});
