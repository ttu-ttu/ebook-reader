/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  abrirDicionario,
  apagarDicionario,
  consultar,
  gravarDicionario,
  versaoGravada
} from './banco';
import { linhasDoArquivo, prepararDicionario, type LinhaTermo } from './formato';

const termos: LinhaTermo[] = [
  ['方', 'かた', '1 n', '', 999800, ['direction'], 1516925, ''],
  ['方', 'ほう', '1 n', '', 999800, ['side'], 1516930, ''],
  ['方', 'がた', '1 suf', '', 999800, ['Sirs'], 2253290, ''],
  ['分かる', 'わかる', '1 v5r', 'v5', 999800, ['to understand'], 1606560, '']
];

const preparado = prepararDicionario({
  termos,
  frequencias: [
    ['方', 'freq', { reading: 'ほう', frequency: { value: 117, displayValue: '117' } }],
    ['方', 'freq', { reading: 'かた', frequency: { value: 304, displayValue: '304' } }],
    ['方', 'freq', { reading: 'がた', frequency: { value: 51301, displayValue: '51301' } }]
  ],
  furiganas: [],
  versao: 'v-teste',
  fontes: {}
});

async function* emFluxo() {
  for (const linha of linhasDoArquivo(preparado)) yield linha;
}

const nome = 'dicionario-teste';
afterEach(() => apagarDicionario(nome));

describe('banco do dicionário', () => {
  it('grava o arquivo e guarda a versão', async () => {
    const db = await abrirDicionario(nome);
    expect(await versaoGravada(db)).toBeUndefined();
    const progresso: number[] = [];
    await gravarDicionario(db, emFluxo(), (n) => progresso.push(n));
    expect(await versaoGravada(db)).toBe('v-teste');
    expect(progresso.at(-1)).toBe(1);
    db.close();
  });

  it('consulta por escrita e por leitura, mais frequente primeiro', async () => {
    const db = await abrirDicionario(nome);
    await gravarDicionario(db, emFluxo());
    expect((await consultar(db, '方')).map((e) => e.seq)).toEqual([1516930, 1516925, 2253290]);
    expect((await consultar(db, 'わかる')).map((e) => e.seq)).toEqual([1606560]);
    expect(await consultar(db, 'ない')).toEqual([]);
    db.close();
  });

  it('gravar de novo troca a versão inteira', async () => {
    const db = await abrirDicionario(nome);
    await gravarDicionario(db, emFluxo());
    const outra = prepararDicionario({
      termos: termos.slice(3),
      frequencias: [],
      furiganas: [],
      versao: 'v2',
      fontes: {}
    });
    await gravarDicionario(
      db,
      (async function* () {
        yield* linhasDoArquivo(outra);
      })()
    );
    expect(await versaoGravada(db)).toBe('v2');
    expect(await consultar(db, '方')).toEqual([]);
    db.close();
  });
});
