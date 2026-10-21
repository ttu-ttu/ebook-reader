/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import type { Pedaco } from '$lib/data/dicionario/tokenizador';
import { alinharLeitura, furiganaAnki, furiganaDaFrase, furiganaDaPalavra } from './furigana';

describe('alinhar a leitura com a escrita', () => {
  it('separa o okurigana', () => {
    expect(alinharLeitura('立ち止まる', 'たちどまる')).toEqual([
      ['立', 'た'],
      'ち',
      ['止', 'ど'],
      'まる'
    ]);
    expect(alinharLeitura('気のせい', 'きのせい')).toEqual([['気', 'き'], 'のせい']);
    expect(alinharLeitura('お茶', 'おちゃ')).toEqual(['お', ['茶', 'ちゃ']]);
  });

  it('compostos de kanji ficam inteiros; kana fica sem leitura', () => {
    expect(alinharLeitura('最初', 'さいしょ')).toEqual([['最初', 'さいしょ']]);
    expect(alinharLeitura('わかる', 'わかる')).toEqual(['わかる']);
    expect(alinharLeitura('時々', 'ときどき')).toEqual([['時々', 'ときどき']]);
  });

  it('katakana na escrita casa com hiragana na leitura', () => {
    expect(alinharLeitura('ヶ月', 'かげつ')).toEqual([['ヶ月', 'かげつ']]);
    expect(alinharLeitura('コーヒー店', 'こーひーてん')).toEqual(['コーヒー', ['店', 'てん']]);
  });

  it('sem alinhamento possível, a leitura vai sobre a palavra inteira', () => {
    expect(alinharLeitura('明日', 'あした')).toEqual([['明日', 'あした']]);
    expect(alinharLeitura('大人しい', 'おとなしー')).toEqual([['大人しい', 'おとなしー']]);
  });
});

describe('formato do Anki (CARDS.md)', () => {
  it('kanji[leitura], com espaço antes de kanji que vem depois de kana ou de outro kanji', () => {
    expect(
      furiganaAnki([
        ['最', 'さい'],
        ['初', 'しょ']
      ])
    ).toBe('最[さい] 初[しょ]');
    expect(furiganaAnki([['気', 'き'], 'のせい'])).toBe('気[き]のせい');
    expect(furiganaAnki(['だと', ['思', 'おも'], 'って'])).toBe('だと 思[おも]って');
    expect(furiganaAnki(['は', '<b>', ['気', 'き'], 'のせい', '</b>'])).toBe(
      'は<b>気[き]のせい</b>'
    );
  });

  it('Word Furigana: JmdictFurigana quando há, senão o alinhamento', () => {
    expect(
      furiganaDaPalavra('最初', 'さいしょ', [
        ['最', 'さい'],
        ['初', 'しょ']
      ])
    ).toBe('最[さい] 初[しょ]');
    expect(furiganaDaPalavra('立ち止まる', 'たちどまる')).toBe('立[た]ち 止[ど]まる');
    expect(furiganaDaPalavra('わかる', 'わかる')).toBe('わかる');
  });
});

describe('Sentence Furigana', () => {
  const pedaco = (superficie: string, leitura: string, inicio: number): Pedaco => ({
    superficie,
    base: superficie,
    leitura,
    classe: '名詞',
    subclasse: '*',
    inicio
  });

  it('furigana em todos os kanji, negrito na palavra (exemplo do CARDS.md)', async () => {
    const frase = '最初は気のせいだと思って無視した。';
    const pedacos = [
      pedaco('最初', 'さいしょ', 0),
      pedaco('は', 'は', 2),
      pedaco('気', 'き', 3),
      pedaco('の', 'の', 4),
      pedaco('せい', 'せい', 5),
      pedaco('だ', 'だ', 7),
      pedaco('と', 'と', 8),
      pedaco('思っ', 'おもっ', 9),
      pedaco('て', 'て', 11),
      pedaco('無視', 'むし', 12),
      pedaco('し', 'し', 14),
      pedaco('た', 'た', 15),
      pedaco('。', '。', 16)
    ];
    const fu: Record<string, [string, string][]> = {
      最初: [
        ['最', 'さい'],
        ['初', 'しょ']
      ],
      無視: [
        ['無', 'む'],
        ['視', 'し']
      ]
    };

    expect(await furiganaDaFrase(frase, pedacos, 3, 7, async (superficie) => fu[superficie])).toBe(
      '最[さい] 初[しょ]は<b>気[き]のせい</b>だと 思[おも]って 無[む] 視[し]した。'
    );
  });

  it('sem JmdictFurigana usa o tokenizador; pedaço sem leitura fica sem furigana', async () => {
    const frase = '桐生は笑った';
    const pedacos = [
      pedaco('桐生', '', 0),
      pedaco('は', 'は', 2),
      pedaco('笑っ', 'わらっ', 3),
      pedaco('た', 'た', 5)
    ];

    expect(await furiganaDaFrase(frase, pedacos, 3, 6)).toBe('桐生は<b>笑[わら]った</b>');
  });

  it('negrito no meio de um pedaço: o pedaço sai sem furigana, mas o negrito fica certo', async () => {
    const frase = '一人暮らし';
    const pedacos = [pedaco('一人暮らし', 'ひとりぐらし', 0)];

    expect(await furiganaDaFrase(frase, pedacos, 2, 5)).toBe('一人<b>暮らし</b>');
  });
});
