/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ordenarPorFrequencia } from './banco';
import { selecionar, type Consulta } from './busca';
import { CASOS_DEFLEXAO } from './busca.casos';
import { lerArquivo, type Entrada } from './formato';
import { criarTokenizador } from './tokenizador';

// Os casos da deflexão contra o JMdict inteiro (dicts/saida, fora do git). Rodar em apps/web:
//   $env:MEDIR_DEFLEXAO="1"; npx vitest run busca.medicao
// Mede também o tempo da busca no toque (no Node, sem IndexedDB).

const pasta = join(process.cwd(), '../../dicts/saida');

describe.skipIf(!process.env.MEDIR_DEFLEXAO)('deflexão com o JMdict inteiro', () => {
  it('acerta os casos e mede o tempo', { timeout: 300_000 }, async () => {
    const [versao] = readdirSync(pasta);
    const texto = gunzipSync(readFileSync(join(pasta, versao, 'dicionario.ndjson.gz'))).toString();
    const { blocosEntradas, blocosIndice } = lerArquivo(texto.split('\n').filter(Boolean));
    const entradas: Entrada[] = blocosEntradas.flatMap(([, bloco]) => bloco);
    const indice = new Map<string, number[]>();

    for (const [, bloco] of blocosIndice) {
      for (const [termo, ids] of Object.entries(bloco)) indice.set(termo, ids);
    }

    const consultar: Consulta = async (termo) =>
      ordenarPorFrequencia(
        (indice.get(termo) ?? []).map((id) => entradas[id]),
        termo
      );
    const tokenizador = await criarTokenizador(
      readFileSync(
        createRequire(import.meta.url).resolve('lindera-wasm-ipadic/lindera_wasm_ipadic_bg.wasm')
      )
    );
    const erros: string[] = [];
    const tempos: number[] = [];

    for (const { frase, toque, termo, selecao } of CASOS_DEFLEXAO) {
      const pedacos = tokenizador.tokenizar(frase);
      const inicio = performance.now();
      const achada = await selecionar(consultar, pedacos, frase.indexOf(toque));

      tempos.push(performance.now() - inicio);

      if (achada?.termo !== termo || (selecao && achada.texto !== selecao)) {
        erros.push(`${frase} · ${toque}: ${achada?.termo} (${achada?.texto}), esperado ${termo}`);
      }
    }

    tempos.sort((a, b) => a - b);
    console.log(
      `${versao}: ${CASOS_DEFLEXAO.length - erros.length}/${CASOS_DEFLEXAO.length} certos; ` +
        `busca no toque: mediana ${tempos[tempos.length >> 1].toFixed(2)} ms, ` +
        `máx ${tempos.at(-1)!.toFixed(2)} ms\n${erros.join('\n')}`
    );
    expect(erros).toEqual([]);
  });
});
