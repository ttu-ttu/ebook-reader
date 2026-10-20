/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { gerarApkg } from './apkg';
import { CAMPOS, etiquetasDoLivro, type CamposCarta } from './modelo';
import referencia from './genanki-referencia.json';

const { entrada, apkg: esperado } = referencia;

let SQL: SqlJsStatic;

beforeAll(async () => {
  SQL = await initSqlJs();
});

function camposDe(lista: string[]): CamposCarta {
  return Object.fromEntries(CAMPOS.map((campo, i) => [campo, lista[i]])) as CamposCarta;
}

// Ignora comentários e espaços, que não mudam o schema.
function normalizarSql(sql: string) {
  return sql
    .replace(/\/\*.*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/ ,/g, ',')
    .trim();
}

async function abrir(blob: Blob) {
  const zip = new ZipReader(new BlobReader(blob), { useWebWorkers: false });
  const entradas = await zip.getEntries();
  const arquivos: Record<string, Uint8Array> = {};
  for (const e of entradas) {
    arquivos[e.filename] = await e.getData!(new Uint8ArrayWriter(), { useWebWorkers: false });
  }
  await zip.close();

  const db = new SQL.Database(arquivos['collection.anki2']);
  const linhas = (tabela: string) => {
    const [res] = db.exec(`SELECT * FROM ${tabela} ORDER BY rowid`);
    return (res?.values ?? []).map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]])));
  };
  const col = linhas('col').map((linha) => ({
    ...linha,
    ...Object.fromEntries(
      ['conf', 'models', 'decks', 'dconf', 'tags'].map((k) => [k, JSON.parse(linha[k] as string)])
    )
  }));
  const [schema] = db.exec('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name');
  const resultado = {
    entradas: entradas.map((e) => e.filename),
    arquivos,
    schema: schema.values.map(([sql]) => normalizarSql(String(sql))),
    col,
    notes: linhas('notes'),
    cards: linhas('cards')
  };
  db.close();
  return resultado;
}

describe('gerarApkg', () => {
  it('gera o mesmo pacote que o genanki', async () => {
    const blob = await gerarApkg(SQL, {
      timestamp: entrada.timestamp,
      notas: entrada.notas.map((n) => ({ campos: camposDe(n.campos), etiquetas: n.etiquetas })),
      midias: entrada.midias.map((m) => ({ nome: m.nome, dados: new Uint8Array(m.bytes) }))
    });
    const obtido = await abrir(blob);

    expect(obtido.entradas).toEqual(esperado.entradas);
    expect(JSON.parse(new TextDecoder().decode(obtido.arquivos.media))).toEqual(esperado.media);
    for (const [nome, bytes] of Object.entries(esperado.arquivos)) {
      expect(Array.from(obtido.arquivos[nome])).toEqual(bytes);
    }
    expect(obtido.schema).toEqual(esperado.schema.map(normalizarSql));
    expect(obtido.col).toEqual(esperado.col);
    expect(obtido.notes).toEqual(esperado.notes);
    expect(obtido.cards).toEqual(esperado.cards);
  });

  it('recusa carta sem Word', async () => {
    await expect(
      gerarApkg(SQL, {
        notas: [{ campos: camposDe(Array(CAMPOS.length).fill('')), etiquetas: [] }],
        midias: []
      })
    ).rejects.toThrow();
  });
});

describe('etiquetasDoLivro', () => {
  it('troca espaços do título por _', () => {
    expect(etiquetasDoLivro('Livro de　Teste')).toEqual(['dokusho', 'dokusho::Livro_de_Teste']);
  });
});
