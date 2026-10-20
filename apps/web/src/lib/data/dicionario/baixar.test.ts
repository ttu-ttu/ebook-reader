/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { linhasDoFluxo } from './baixar';

function fluxo(pedacos: string[]) {
  return new ReadableStream<string>({
    start(controle) {
      pedacos.forEach((p) => controle.enqueue(p));
      controle.close();
    }
  });
}

async function juntar(linhas: AsyncIterable<string>) {
  const todas: string[] = [];
  for await (const linha of linhas) todas.push(linha);
  return todas;
}

describe('linhasDoFluxo', () => {
  it('junta linhas cortadas entre pedaços', async () => {
    expect(
      await juntar(linhasDoFluxo(fluxo(['{"a"', ':1}\n["e",', '0,[]]\n', '["i"', ',"x",{}]'])))
    ).toEqual(['{"a":1}', '["e",0,[]]', '["i","x",{}]']);
  });

  it('ignora a quebra final', async () => {
    expect(await juntar(linhasDoFluxo(fluxo(['a\nb\n'])))).toEqual(['a', 'b']);
  });
});
