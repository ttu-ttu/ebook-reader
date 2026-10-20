/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Medição do R4 (não é teste de regra): tokeniza um EPUB, liga o texto e os Cards do Anki ao
// JMdict e imprime as taxas. Pulada sem MEDIR_CASAMENTO. Precisa do Anki do PC aberto e do
// dicionário em dicts/saida/. Rodar em apps/web:
//   $env:MEDIR_CASAMENTO="caminho\livro.epub"; pnpm vitest run casamento.medicao
// MEDIR_SAIDA=<arquivo.json> grava as listas completas.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import { ordenarPorFrequencia } from '$lib/data/dicionario/banco';
import { lerArquivo, type Entrada } from '$lib/data/dicionario/formato';
import { criarTokenizador } from '$lib/data/dicionario/tokenizador';
import { criarAnkiConnect } from '$lib/functions/anki/anki-connect';
import {
  casarCard,
  casarPedaco,
  chavePalavra,
  type Consulta,
  type PalavraJmdict
} from './casamento';

const EPUB = process.env.MEDIR_CASAMENTO;
const SAIDA = process.env.MEDIR_SAIDA;
const RAIZ = resolve(__dirname, '../../../../../..');

function carregarDicionario(): Consulta {
  const pasta = join(RAIZ, 'dicts/saida');
  const versao = readdirSync(pasta).sort().at(-1)!;
  const texto = gunzipSync(readFileSync(join(pasta, versao, 'dicionario.ndjson.gz'))).toString();
  const { blocosEntradas, blocosIndice } = lerArquivo(texto.split('\n').filter(Boolean));
  const entradas: Entrada[] = blocosEntradas.flatMap(([, bloco]) => bloco);
  entradas.sort((a, b) => a.id - b.id);
  const indice = new Map<string, number[]>();
  for (const [, bloco] of blocosIndice)
    for (const [t, ids] of Object.entries(bloco)) indice.set(t, ids);
  return async (termo) =>
    ordenarPorFrequencia(
      (indice.get(termo) ?? []).map((id) => entradas[id]),
      termo
    );
}

async function textoDoEpub(caminho: string) {
  const zip = new ZipReader(new BlobReader(new Blob([readFileSync(caminho)])), {
    useWebWorkers: false
  });
  const arquivos = await zip.getEntries();
  const ler = (nome: string) =>
    arquivos.find((a) => a.filename === nome)!.getData!(new TextWriter());
  const container = await ler('META-INF/container.xml');
  const opf = /full-path="([^"]+)"/.exec(container)![1];
  const pasta = opf.includes('/') ? opf.slice(0, opf.lastIndexOf('/') + 1) : '';
  const conteudoOpf = await ler(opf);
  const hrefs = new Map(
    [...conteudoOpf.matchAll(/<item\b[^>]*>/g)].map(([tag]) => [
      /id="([^"]+)"/.exec(tag)![1],
      /href="([^"]+)"/.exec(tag)![1]
    ])
  );
  const ordem = [...conteudoOpf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map(([, id]) =>
    decodeURIComponent(hrefs.get(id)!)
  );
  const partes: string[] = [];
  for (const href of ordem) {
    const html = await ler(pasta + href);
    const corpo = html.slice(html.search(/<body/i));
    partes.push(
      corpo
        .replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1>/g, '')
        .replace(/<\/(p|div|h\d|br)>|<br\s*\/?>/g, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
    );
  }
  await zip.close();
  return partes.join('\n');
}

const contar = <T>(mapa: Map<string, T & { n: number }>, chave: string, novo: () => T) => {
  const atual = mapa.get(chave);
  if (atual) atual.n++;
  else mapa.set(chave, { ...novo(), n: 1 });
};
const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`;
const SO_KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

describe.skipIf(!EPUB)('medição do casamento (R4)', () => {
  it('mede texto e Anki', { timeout: 600_000 }, async () => {
    const consultar = carregarDicionario();
    const wasm = createRequire(import.meta.url).resolve(
      'lindera-wasm-ipadic/lindera_wasm_ipadic_bg.wasm'
    );
    const tokenizador = await criarTokenizador(readFileSync(wasm));

    // Anki: uma Palavra por leitura de cada Card.
    const cards = await criarAnkiConnect().buscarCards('日本語');
    const pares = new Map<string, { word: string; leitura: string; deck: string }>();
    for (const c of cards)
      pares.set(`${c.word}|${c.wordReading}`, {
        word: c.word,
        leitura: c.wordReading,
        deck: c.deck
      });
    const noAnki = new Map<string, string>();
    const seqsAnki = new Map<number, string>();
    const escritasAnki = new Set<string>();
    const cardsSemEntrada: string[] = [];
    const cardsAmbiguos: string[] = [];
    for (const { word, leitura, deck } of pares.values()) {
      escritasAnki.add(word);
      const { palavras, ambiguo } = await casarCard(consultar, word, leitura);
      if (!palavras.length) cardsSemEntrada.push(`${word}【${leitura}】 ${deck}`);
      if (ambiguo)
        cardsAmbiguos.push(`${word}【${leitura}】 → ${palavras.map((p) => p.seq).join(', ')}`);
      for (const p of palavras) {
        noAnki.set(chavePalavra(p), word);
        seqsAnki.set(p.seq, `${word}【${leitura}】`);
      }
    }

    // Texto.
    const texto = await textoDoEpub(EPUB!);
    const pedacos = texto.split('\n').flatMap((linha) => tokenizador.tokenizar(linha));
    let gramatica = 0;
    let casados = 0;
    let ambiguos = 0;
    let soKana = 0;
    const semEntrada = new Map<string, { classe: string; n: number }>();
    const palavras = new Map<
      string,
      { p: PalavraJmdict; base: string; soKana: boolean; candidatas: PalavraJmdict[]; n: number }
    >();
    for (const pedaco of pedacos) {
      const r = await casarPedaco(consultar, pedaco);
      if (!r) {
        gramatica++;
        continue;
      }
      if (!r.palavra) {
        contar(semEntrada, `${pedaco.base} (${pedaco.superficie})`, () => ({
          classe: `${pedaco.classe},${pedaco.subclasse}`
        }));
        continue;
      }
      casados++;
      if (r.candidatas.length > 1) ambiguos++;
      const kana = SO_KANA.test(pedaco.superficie);
      if (kana) soKana++;
      contar(palavras, chavePalavra(r.palavra), () => ({
        p: r.palavra!,
        base: pedaco.base,
        soKana: kana,
        candidatas: r.candidatas
      }));
    }
    const conteudo = pedacos.length - gramatica;

    // Texto ↔ Anki.
    const distintas = [...palavras.values()];
    const casaAnki = distintas.filter((x) => noAnki.has(chavePalavra(x.p)));
    const casaAnkiQualquer = distintas.filter((x) =>
      x.candidatas.some((c) => noAnki.has(chavePalavra(c)))
    );
    const soPelaEscrita = distintas.filter((x) => escritasAnki.has(x.base));
    const ganhoDoJmdict = casaAnki.filter((x) => !escritasAnki.has(x.base));
    const perdaDoJmdict = soPelaEscrita.filter((x) => !noAnki.has(chavePalavra(x.p)));
    const ambiguasNoAnki = casaAnkiQualquer.filter((x) => !noAnki.has(chavePalavra(x.p)));
    const ambiguasDistintas = distintas.filter((x) => x.candidatas.length > 1);
    const outraLeitura = distintas.filter(
      (x) => !noAnki.has(chavePalavra(x.p)) && seqsAnki.has(x.p.seq)
    );
    const descrever = (x: (typeof distintas)[number]) =>
      `${x.base}【${x.p.leitura}】×${x.n}${noAnki.has(chavePalavra(x.p)) ? ` = ${noAnki.get(chavePalavra(x.p))}` : ''}`;
    const porN = <T extends { n: number }>(lista: T[]) => [...lista].sort((a, b) => b.n - a.n);

    const relatorio = {
      anki: {
        cards: cards.length,
        pares: pares.size,
        semEntrada: cardsSemEntrada.length,
        ambiguos: cardsAmbiguos.length,
        palavras: noAnki.size
      },
      texto: {
        caracteres: texto.length,
        pedacos: pedacos.length,
        gramatica,
        conteudo,
        casados: `${casados} (${pct(casados, conteudo)})`,
        semEntrada: `${conteudo - casados} (${pct(conteudo - casados, conteudo)})`,
        ambiguos: `${ambiguos} (${pct(ambiguos, casados)})`,
        soKana: `${soKana} (${pct(soKana, casados)})`,
        palavrasDistintas: distintas.length,
        palavrasAmbiguas: ambiguasDistintas.length
      },
      textoAnki: {
        palavrasNoAnki: casaAnki.length,
        ocorrenciasNoAnki: casaAnki.reduce((s, x) => s + x.n, 0),
        comQualquerCandidata: casaAnkiQualquer.length,
        pelaEscrita: soPelaEscrita.length,
        ganhoDoJmdict: ganhoDoJmdict.length,
        perdaDoJmdict: perdaDoJmdict.length,
        mesmaEntradaOutraLeitura: `${outraLeitura.length} (${outraLeitura.reduce((s, x) => s + x.n, 0)} ocorrências)`
      }
    };
    console.log(JSON.stringify(relatorio, null, 2));
    const listas = {
      cardsSemEntrada,
      cardsAmbiguos,
      textoSemEntrada: porN([...semEntrada].map(([t, v]) => ({ t, ...v }))).map(
        (x) => `${x.t} ${x.classe} ×${x.n}`
      ),
      ambiguasNoTexto: porN(ambiguasDistintas).map(
        (x) =>
          `${descrever(x)} | ${x.candidatas.map((c) => `${c.seq}【${c.leitura}】${noAnki.get(chavePalavra(c)) ?? ''}`).join(' / ')}`
      ),
      ganhoDoJmdict: porN(ganhoDoJmdict).map(descrever),
      perdaDoJmdict: porN(perdaDoJmdict).map(
        (x) =>
          `${descrever(x)}${seqsAnki.has(x.p.seq) ? ` | mesma entrada no Anki: ${seqsAnki.get(x.p.seq)}` : ''}`
      ),
      mesmaEntradaOutraLeitura: porN(outraLeitura).map(
        (x) => `${descrever(x)} | ${seqsAnki.get(x.p.seq)}`
      ),
      ambiguasQueCairiamNoAnki: porN(ambiguasNoAnki).map(
        (x) =>
          `${descrever(x)} | ${x.candidatas
            .filter((c) => noAnki.has(chavePalavra(c)))
            .map((c) => noAnki.get(chavePalavra(c)))
            .join(', ')}`
      ),
      soKanaNoAnki: porN(casaAnki.filter((x) => x.soKana)).map(descrever)
    };
    for (const [nome, lista] of Object.entries(listas))
      console.log(`\n## ${nome} (${lista.length})\n${lista.slice(0, 40).join('\n')}`);
    if (SAIDA) writeFileSync(SAIDA, JSON.stringify({ relatorio, listas }, null, 2));
    expect(casados).toBeGreaterThan(0);
  });
});
