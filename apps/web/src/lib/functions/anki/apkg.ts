/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { SqlJsStatic } from 'sql.js';
import { BlobWriter, Uint8ArrayReader, BlobReader, ZipWriter } from '@zip.js/zip.js';
import { guidFor } from './guid';
import { CAMPOS, DECK, MODEL_ID, deckJson, modeloJson, type CamposCarta } from './modelo';

export interface NotaApkg {
  campos: CamposCarta;
  etiquetas: string[];
}

export interface MidiaApkg {
  nome: string;
  dados: Uint8Array | Blob;
}

export interface EntradaApkg {
  notas: NotaApkg[];
  midias: MidiaApkg[];
  /** Segundos desde a época; padrão: agora. Reimportar o mesmo arquivo não altera as notas. */
  timestamp?: number;
}

const SCHEMA = `
CREATE TABLE col (
    id integer primary key, crt integer not null, mod integer not null, scm integer not null,
    ver integer not null, dty integer not null, usn integer not null, ls integer not null,
    conf text not null, models text not null, decks text not null, dconf text not null,
    tags text not null
);
CREATE TABLE notes (
    id integer primary key, guid text not null, mid integer not null, mod integer not null,
    usn integer not null, tags text not null, flds text not null, sfld integer not null,
    csum integer not null, flags integer not null, data text not null
);
CREATE TABLE cards (
    id integer primary key, nid integer not null, did integer not null, ord integer not null,
    mod integer not null, usn integer not null, type integer not null, queue integer not null,
    due integer not null, ivl integer not null, factor integer not null, reps integer not null,
    lapses integer not null, left integer not null, odue integer not null, odid integer not null,
    flags integer not null, data text not null
);
CREATE TABLE revlog (
    id integer primary key, cid integer not null, usn integer not null, ease integer not null,
    ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null,
    type integer not null
);
CREATE TABLE graves (
    usn integer not null, oid integer not null, type integer not null
);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

// APKG_COL do genanki.
const COL_CONF = {
  activeDecks: [1],
  addToCur: true,
  collapseTime: 1200,
  curDeck: 1,
  curModel: '1425279151691',
  dueCounts: true,
  estTimes: true,
  newBury: true,
  newSpread: 0,
  nextPos: 1,
  sortBackwards: false,
  sortType: 'noteFld',
  timeLim: 0
};

const COL_DECK_PADRAO = {
  collapsed: false,
  conf: 1,
  desc: '',
  dyn: 0,
  extendNew: 10,
  extendRev: 50,
  id: 1,
  lrnToday: [0, 0],
  mod: 1425279151,
  name: 'Default',
  newToday: [0, 0],
  revToday: [0, 0],
  timeToday: [0, 0],
  usn: 0
};

const COL_DCONF = {
  '1': {
    autoplay: true,
    id: 1,
    lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
    maxTaken: 60,
    mod: 0,
    name: 'Default',
    new: {
      bury: true,
      delays: [1, 10],
      initialFactor: 2500,
      ints: [1, 4, 7],
      order: 1,
      perDay: 20,
      separate: true
    },
    replayq: true,
    rev: {
      bury: true,
      ease4: 1.3,
      fuzz: 0.05,
      ivlFct: 1,
      maxIvl: 36500,
      minSpace: 1,
      perDay: 100
    },
    timer: 0,
    usn: 0
  }
};

export async function gerarApkg(SQL: SqlJsStatic, entrada: EntradaApkg): Promise<Blob> {
  const timestamp = entrada.timestamp ?? Date.now() / 1000;
  const mod = Math.floor(timestamp);
  let proximoId = Math.floor(timestamp * 1000);

  const db = new SQL.Database();
  try {
    db.run(SCHEMA);
    db.run('INSERT INTO col VALUES(null,?,?,?,?,?,?,?,?,?,?,?,?)', [
      1411124400,
      1425279151694,
      1425279151690,
      11,
      0,
      0,
      0,
      JSON.stringify(COL_CONF),
      JSON.stringify({ [MODEL_ID]: modeloJson(timestamp) }),
      JSON.stringify({ '1': COL_DECK_PADRAO, [DECK.id]: deckJson() }),
      JSON.stringify(COL_DCONF),
      '{}'
    ]);

    for (const nota of entrada.notas) {
      const word = nota.campos.Word;
      if (!word) throw new Error('Carta sem Word');
      for (const etiqueta of nota.etiquetas) {
        if (/\s/.test(etiqueta)) throw new Error(`Etiqueta com espaço: ${etiqueta}`);
      }
      const campos = CAMPOS.map((c) => nota.campos[c] ?? '');
      const guid = await guidFor(DECK.guid, word, nota.campos['Word Reading'] ?? '');

      const idNota = proximoId++;
      db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)', [
        idNota,
        guid,
        MODEL_ID,
        mod,
        -1,
        ` ${nota.etiquetas.join(' ')} `,
        campos.join('\x1f'),
        word,
        0,
        0,
        ''
      ]);
      // Um card (frente/verso), novo, no deck do Dokusho.
      db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        proximoId++,
        idNota,
        DECK.id,
        0,
        mod,
        -1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        ''
      ]);
    }

    const colecao = db.export();
    // Mídia sem compressão: WAV comprime pouco e o iPhone gasta menos.
    const zip = new ZipWriter(new BlobWriter('application/zip'), {
      level: 0,
      useWebWorkers: typeof Worker !== 'undefined'
    });
    await zip.add('collection.anki2', new Uint8ArrayReader(colecao), { level: 6 });
    const media = Object.fromEntries(entrada.midias.map((m, i) => [String(i), m.nome]));
    await zip.add('media', new Uint8ArrayReader(new TextEncoder().encode(JSON.stringify(media))));
    for (const [i, midia] of entrada.midias.entries()) {
      const leitor =
        midia.dados instanceof Blob
          ? new BlobReader(midia.dados)
          : new Uint8ArrayReader(midia.dados);
      await zip.add(String(i), leitor);
    }
    return await zip.close();
  } finally {
    db.close();
  }
}
