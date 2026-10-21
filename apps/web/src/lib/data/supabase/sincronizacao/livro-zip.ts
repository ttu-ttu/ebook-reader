/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter
} from '@zip.js/zip.js';
import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';

// O livro processado pelo ttu (ADR 0001), no mesmo desenho do zip que o ttu manda ao Google Drive:
// staticdata.json com o texto, blobs/<nome> com as imagens e cover.<ext> com a capa.

export type LivroProcessado = Omit<BooksDbBookData, 'id'>;

// Sem Worker (testes no Node), o zip.js trabalha na thread principal.
const opcoesZip = { useWebWorkers: typeof Worker !== 'undefined' };

type DadosFixos = Pick<
  LivroProcessado,
  'title' | 'styleSheet' | 'elementHtml' | 'htmlBackup' | 'sections' | 'language' | 'characters'
>;

export async function zipLivro(livro: LivroProcessado) {
  const zip = new ZipWriter(new BlobWriter('application/zip'), opcoesZip);
  const fixos: DadosFixos = {
    title: livro.title,
    styleSheet: livro.styleSheet,
    elementHtml: livro.elementHtml,
    htmlBackup: livro.htmlBackup,
    sections: livro.sections,
    language: livro.language,
    characters: livro.characters
  };

  for (const [nome, blob] of Object.entries(livro.blobs || {})) {
    await zip.add(`blobs/${nome}`, new BlobReader(blob));
  }

  if (livro.coverImage instanceof Blob) {
    await zip.add(`cover.${extensaoDaImagem(livro.coverImage)}`, new BlobReader(livro.coverImage));
  }

  await zip.add('staticdata.json', new TextReader(JSON.stringify(fixos)));

  return zip.close();
}

export async function deszipLivro(arquivo: Blob): Promise<LivroProcessado> {
  const leitor = new ZipReader(new BlobReader(arquivo), opcoesZip);
  const livro: LivroProcessado = {
    title: '',
    styleSheet: '',
    elementHtml: '',
    blobs: {},
    coverImage: '',
    hasThumb: true,
    characters: 0,
    sections: [],
    lastBookModified: 0,
    lastBookOpen: 0
  };

  try {
    for (const entrada of await leitor.getEntries()) {
      if (entrada.directory) continue;

      if (entrada.filename === 'staticdata.json') {
        const fixos = JSON.parse(await entrada.getData!(new TextWriter())) as DadosFixos;

        Object.assign(livro, fixos);
      } else if (entrada.filename.startsWith('blobs/')) {
        const nome = entrada.filename.slice('blobs/'.length);

        livro.blobs[nome] = await entrada.getData!(new BlobWriter(tipoDaImagem(nome)));
      } else if (entrada.filename.startsWith('cover.')) {
        livro.coverImage = await entrada.getData!(new BlobWriter(tipoDaImagem(entrada.filename)));
      }
    }
  } finally {
    await leitor.close();
  }

  if (!livro.elementHtml) {
    throw new Error('Livro processado sem texto');
  }

  return livro;
}

function extensaoDaImagem(imagem: Blob) {
  return imagem.type.replace('image/', '').replace('svg+xml', 'svg') || 'jpeg';
}

function tipoDaImagem(nome: string) {
  const extensao = nome.split('.').pop()?.toLowerCase() || '';

  if (extensao === 'svg') return 'image/svg+xml';
  if (['png', 'gif', 'bmp', 'webp'].includes(extensao)) return `image/${extensao}`;
  return 'image/jpeg';
}
