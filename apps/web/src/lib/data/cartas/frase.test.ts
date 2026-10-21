/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { comNegrito, contextoDaFrase, fraseEm } from './frase';

const em = (texto: string, palavra: string) => {
  const inicio = texto.indexOf(palavra);

  return fraseEm(texto, inicio, inicio + palavra.length);
};

describe('Frase (ESCOPO "Cards")', () => {
  it('vai do último 。！？ até o próximo, inclusive', () => {
    const texto = '雨が降っていた。彼は傘を持っていなかった！どうしよう？';

    expect(em(texto, '傘').frase).toBe('彼は傘を持っていなかった！');
    expect(em(texto, '雨').frase).toBe('雨が降っていた。');
    expect(em(texto, 'どう').frase).toBe('どうしよう？');
  });

  it('não corta dentro de 「」', () => {
    const texto = '「もう帰ろう。疲れた」と彼女は言った。それから歩き出した。';

    expect(em(texto, '疲れ').frase).toBe('「もう帰ろう。疲れた」と彼女は言った。');
    expect(em(texto, '歩き').frase).toBe('それから歩き出した。');
  });

  it('frase sem pontuação final vai até o fim do parágrafo', () => {
    expect(em('最初は気のせいだと思った', '気').frase).toBe('最初は気のせいだと思った');
  });

  it('tira espaços das pontas e devolve a posição da palavra na frase', () => {
    const r = em('前の文。　最初は気のせいだと思った。', '気のせい');

    expect(r.frase).toBe('最初は気のせいだと思った。');
    expect(r.frase.slice(r.inicio, r.fim)).toBe('気のせい');
  });

  it('acima de ~150 caracteres corta perto da palavra, num 、', () => {
    const longa = `${'あ'.repeat(100)}、${'い'.repeat(60)}、彼は気がついた、${'う'.repeat(100)}。`;
    const r = em(longa, '気が');

    expect(r.frase.length).toBeLessThanOrEqual(150);
    expect(r.frase).toContain('彼は気がついた');
    expect(r.frase.startsWith('…')).toBe(true);
    expect(r.frase.endsWith('…')).toBe(true);
    expect(r.frase.slice(r.inicio, r.fim)).toBe('気が');
  });

  it('negrito em volta da palavra, na forma em que aparece', () => {
    const r = em('最初は気のせいだと思って無視した。', '気のせい');

    expect(comNegrito(r)).toBe('最初は<b>気のせい</b>だと思って無視した。');
  });

  it('contexto: frase anterior e seguinte, inclusive dos parágrafos vizinhos', () => {
    const paragrafo = '一つ目。二つ目の文。三つ目。';
    const meio = em(paragrafo, '二つ目');

    expect(contextoDaFrase(paragrafo, meio, '前の段落。', '次の段落。')).toEqual({
      antes: '一つ目。',
      depois: '三つ目。'
    });

    const primeira = em(paragrafo, '一つ目');

    expect(contextoDaFrase(paragrafo, primeira, '前の段落の最後。', '')).toEqual({
      antes: '前の段落の最後。',
      depois: '二つ目の文。'
    });

    const ultima = em(paragrafo, '三つ目');

    expect(contextoDaFrase(paragrafo, ultima, '', '次の段落。続き。').depois).toBe('次の段落。');
  });
});
