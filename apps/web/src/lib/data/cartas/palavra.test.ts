/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import type { Entrada } from '$lib/data/dicionario/formato';
import type { Pedaco } from '$lib/data/dicionario/tokenizador';
import { formaDaEntrada, montarCarta, ordenarEntradas } from './palavra';

const entrada = (seq: number, formas: Entrada['formas'], tags: string[] = []): Entrada => ({
  id: seq,
  seq,
  formas,
  sentidos: [{ t: tags, g: ['gloss'] }]
});

const kata = entrada(1, [{ e: '方', l: 'かた', f: 300 }]);
const hou = entrada(2, [{ e: '方', l: 'ほう', f: 100 }]);
const wakaru = entrada(3, [
  { e: '分かる', l: 'わかる', f: 40, fk: 30 },
  { e: '判る', l: 'わかる' }
]);
const yameru = entrada(4, [{ e: '止める', l: 'やめる', f: 900, fk: 200 }], ['v1', 'uk']);
const kinosei = entrada(5, [
  { e: '気のせい', l: 'きのせい', f: 9000, fu: [['気', 'き'], 'のせい'] }
]);

describe('entradas no painel', () => {
  it('a que bate com o furigana do EPUB vem primeiro; sem furigana, a ordem da frequência', () => {
    expect(ordenarEntradas([hou, kata], 'かた').map((e) => e.seq)).toEqual([1, 2]);
    expect(ordenarEntradas([hou, kata]).map((e) => e.seq)).toEqual([2, 1]);
  });
});

describe('Word e Word Reading da entrada aberta', () => {
  it('kanji do dicionário quando o texto escreve em kana', () => {
    expect(formaDaEntrada(wakaru, 'わかる')).toMatchObject({
      escrita: '分かる',
      leitura: 'わかる',
      frequencia: 40
    });
  });

  it('palavra "usually kana" fica em kana', () => {
    expect(formaDaEntrada(yameru, 'やめる')).toMatchObject({
      escrita: 'やめる',
      leitura: 'やめる'
    });
  });

  it('escrita do texto quando o dicionário a tem; leitura pela preferida', () => {
    expect(formaDaEntrada(kata, '方', 'かた')).toMatchObject({ escrita: '方', leitura: 'かた' });
    expect(formaDaEntrada(wakaru, '判る')).toMatchObject({ escrita: '判る', leitura: 'わかる' });
  });
});

describe('Criar carta (parte local, ADR 0010)', () => {
  const pedaco = (
    superficie: string,
    leitura: string,
    inicio: number,
    base = superficie
  ): Pedaco => ({
    superficie,
    base,
    leitura,
    classe: '名詞',
    subclasse: '*',
    inicio
  });

  it('preenche Word, leitura, furigana, Frase com <b>, frequência, contexto e o livro', async () => {
    const paragrafo = '前の文。最初は気のせいだと思った。次の文。';
    const inicio = paragrafo.indexOf('気のせい');
    const carta = await montarCarta({
      id: 'carta-1',
      agora: '2026-10-21T10:00:00.000Z',
      livroId: 'hash-do-livro',
      entrada: kinosei,
      termo: '気のせい',
      paragrafo,
      inicio,
      fim: inicio + 4,
      paragrafoAnterior: '',
      paragrafoSeguinte: '',
      tokenizar: (frase) =>
        frase === '最初は気のせいだと思った。'
          ? [
              pedaco('最初', 'さいしょ', 0),
              pedaco('は', 'は', 2),
              pedaco('気', 'き', 3),
              pedaco('の', 'の', 4),
              pedaco('せい', 'せい', 5),
              pedaco('だ', 'だ', 7),
              pedaco('と', 'と', 8),
              pedaco('思っ', 'おもっ', 9, '思う'),
              pedaco('た', 'た', 11),
              pedaco('。', '。', 12)
            ]
          : [],
      furiganaDoDicionario: async (superficie) =>
        superficie === '最初'
          ? [
              ['最', 'さい'],
              ['初', 'しょ']
            ]
          : undefined
    });

    expect(carta).toMatchObject({
      id: 'carta-1',
      book_id: 'hash-do-livro',
      jmdict_id: 5,
      word: '気のせい',
      word_reading: 'きのせい',
      word_furigana: '気[き]のせい',
      sentence: '最初は<b>気のせい</b>だと思った。',
      sentence_furigana: '最[さい] 初[しょ]は<b>気[き]のせい</b>だと 思[おも]った。',
      sentence_before: '前の文。',
      sentence_after: '次の文。',
      frequency: 9000,
      state: 'pendente',
      modified_at: '2026-10-21T10:00:00.000Z',
      deleted_at: null,
      word_meaning: null,
      sentence_meaning: null
    });
  });

  it('palavra fora do dicionário: a seleção vira a Word, sem leitura nem frequência', async () => {
    const paragrafo = 'ミナトは笑った。';
    const carta = await montarCarta({
      id: 'c',
      agora: '2026-10-21T10:00:00.000Z',
      livroId: 'l',
      termo: 'ミナト',
      paragrafo,
      inicio: 0,
      fim: 3,
      tokenizar: () => []
    });

    expect(carta).toMatchObject({
      word: 'ミナト',
      word_reading: 'みなと',
      jmdict_id: null,
      frequency: null,
      sentence: '<b>ミナト</b>は笑った。'
    });
  });
});
