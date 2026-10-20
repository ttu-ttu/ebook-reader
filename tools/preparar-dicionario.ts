// Converte os zips Yomitan de dicts/ para o formato do app (ADR 0004).
// Uso (na raiz): node tools/preparar-dicionario.ts
// Saída: dicts/saida/<versao>/dicionario.ndjson.gz e dicts/saida/<versao>/manifesto.json

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  FORMATO,
  linhasDoArquivo,
  prepararDicionario,
  type LinhaFrequencia,
  type LinhaFurigana,
  type LinhaTermo
} from '../apps/web/src/lib/data/dicionario/formato.ts';

const raiz = join(import.meta.dirname, '..');
const pastaDicts = join(raiz, 'dicts');
const doApp = createRequire(join(raiz, 'apps/web/package.json'));
const zipjs = await import(pathToFileURL(doApp.resolve('@zip.js/zip.js')).href);
zipjs.configure({ useWebWorkers: false });

async function lerZip(nome: string) {
  const leitor = new zipjs.ZipReader(
    new zipjs.Uint8ArrayReader(new Uint8Array(readFileSync(join(pastaDicts, nome))))
  );
  const arquivos = new Map<string, string>();
  for (const item of await leitor.getEntries()) {
    if (!item.directory) arquivos.set(item.filename, await item.getData(new zipjs.TextWriter()));
  }
  await leitor.close();
  return arquivos;
}

function achar(prefixo: string) {
  const nome = readdirSync(pastaDicts).find((n) => n.startsWith(prefixo) && n.endsWith('.zip'));
  if (!nome) throw new Error(`Falta dicts/${prefixo}*.zip`);
  return nome;
}

const json = (texto: string) => JSON.parse(texto.replace(/^﻿/, ''));

console.time('leitura');
const jmdict = await lerZip(achar('JMdict_english'));
const jpdb = await lerZip(achar('JPDB'));
const furigana = await lerZip(achar('JmdictFurigana'));
console.timeEnd('leitura');

const indiceJmdict = json(jmdict.get('index.json')!);
const indiceJpdb = json(jpdb.get('index.json')!);
const nomeFurigana = achar('JmdictFurigana');

const termos: LinhaTermo[] = [];
for (const [nome, texto] of jmdict)
  if (nome.startsWith('term_bank_')) for (const l of json(texto)) termos.push(l);
const frequencias: LinhaFrequencia[] = [];
for (const [nome, texto] of jpdb)
  if (nome.startsWith('term_meta_bank_')) for (const l of json(texto)) frequencias.push(l);
const furiganas: LinhaFurigana[] = json([...furigana.values()][0]);

const dataJmdict = String(indiceJmdict.revision).replace(/^JMdict\./, '');
const versao = `jmdict-${dataJmdict}-f${FORMATO}`;

console.time('preparo');
const preparado = prepararDicionario({
  termos,
  frequencias,
  furiganas,
  versao,
  fontes: {
    JMdict: String(indiceJmdict.revision),
    JPDB: String(indiceJpdb.revision),
    JmdictFurigana: nomeFurigana
  }
});
const texto = [...linhasDoArquivo(preparado)].join('\n') + '\n';
const gz = gzipSync(Buffer.from(texto, 'utf8'), { level: 9 });
console.timeEnd('preparo');

const saida = join(pastaDicts, 'saida', versao);
mkdirSync(saida, { recursive: true });
writeFileSync(join(saida, 'dicionario.ndjson.gz'), gz);
const manifesto = {
  ...preparado.cabecalho,
  arquivo: 'dicionario.ndjson.gz',
  bytes: gz.length,
  bytesDescompactado: Buffer.byteLength(texto),
  sha256: createHash('sha256').update(gz).digest('hex'),
  geradoEm: new Date().toISOString()
};
writeFileSync(join(saida, 'manifesto.json'), JSON.stringify(manifesto, null, 2));

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;
console.log(
  `${versao}: ${preparado.entradas.length} entradas, ${preparado.indice.size} chaves, ` +
    `${mb(manifesto.bytesDescompactado)} → ${mb(gz.length)} em ${saida}`
);
