/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { criarTokenizador, type Tokenizador } from './tokenizador';

let tokenizador: Tokenizador;

beforeAll(async () => {
  const caminho = createRequire(import.meta.url).resolve(
    'lindera-wasm-ipadic/lindera_wasm_ipadic_bg.wasm'
  );
  tokenizador = await criarTokenizador(readFileSync(caminho));
});

describe('tokenizador', () => {
  it('devolve a forma de dicionário e a leitura em hiragana', () => {
    const pedacos = tokenizador.tokenizar('彼はふと気がついた。');
    expect(pedacos.map((p) => p.superficie)).toEqual(['彼', 'は', 'ふと', '気がつい', 'た', '。']);
    expect(pedacos[3]).toMatchObject({ base: '気がつく', leitura: 'きがつい', classe: '動詞' });
  });

  it('marca o começo de cada pedaço em caracteres, com espaços e caracteres fora do BMP', () => {
    const texto = '𠮟られた　少女';
    const pedacos = tokenizador.tokenizar(texto);
    for (const p of pedacos)
      expect(texto.slice(p.inicio, p.inicio + p.superficie.length)).toBe(p.superficie);
    expect(pedacos.at(-1)!.superficie).toBe('少女');
  });

  it('palavra desconhecida usa a própria superfície como base', () => {
    const [pedaco] = tokenizador.tokenizar('ぴえん');
    expect(pedaco.base).toBeTruthy();
  });
});
