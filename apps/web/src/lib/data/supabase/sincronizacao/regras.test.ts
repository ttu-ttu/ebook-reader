/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  alcancePelaLeitura,
  alcanceRecebido,
  caminhosDoLivro,
  estatisticaParaLinha,
  hashDoArquivo,
  linhaParaEstatistica,
  linhaParaMarcador,
  linhaParaMeta,
  marcadorParaLinha,
  metaParaLinha,
  nomeDoAparelho,
  paraIso,
  precisaEnviar,
  remotoVence,
  textoMarcadorRemoto,
  type LinhaEstatistica,
  type LinhaMarcador,
  type LinhaMeta
} from './regras';
import { ReadingGoalFrequency } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';

const aparelho = { id: 'ap-1', nome: 'iPad' };
const t = (iso: string) => Date.parse(iso);

describe('última escrita pelo horário do aparelho', () => {
  it('o servidor vence só quando foi modificado depois', () => {
    expect(remotoVence(undefined, '2026-10-21T10:00:00Z')).toBe(true);
    expect(remotoVence(t('2026-10-21T09:00:00Z'), '2026-10-21T10:00:00Z')).toBe(true);
    expect(remotoVence(t('2026-10-21T10:00:00Z'), '2026-10-21T10:00:00Z')).toBe(false);
    expect(remotoVence(t('2026-10-21T11:00:00Z'), '2026-10-21T10:00:00Z')).toBe(false);
  });

  it('envia o que mudou depois do último envio', () => {
    expect(precisaEnviar(10, undefined)).toBe(true);
    expect(precisaEnviar(10, 10)).toBe(false);
    expect(precisaEnviar(11, 10)).toBe(true);
    expect(precisaEnviar(9, 10)).toBe(false);
  });
});

describe('Alcance', () => {
  it('a leitura só aumenta o Alcance', () => {
    expect(alcancePelaLeitura(undefined, 30)).toBe(30);
    expect(alcancePelaLeitura(50, 30)).toBe(50);
    expect(alcancePelaLeitura(50, 70)).toBe(70);
  });

  it('linha mais nova do outro aparelho manda, mesmo menor (desmarcar lá)', () => {
    const linha = { reach_char_count: 20, modified_at: '2026-10-21T10:00:00Z' };

    expect(alcanceRecebido({ valor: 50 }, t('2026-10-21T09:00:00Z'), linha)).toEqual({ valor: 20 });
  });

  it('linha mais velha não baixa o Alcance, mas pode aumentar', () => {
    const local = { valor: 30 };
    const marcadorMs = t('2026-10-21T11:00:00Z');

    expect(
      alcanceRecebido(local, marcadorMs, {
        reach_char_count: 50,
        modified_at: '2026-10-21T10:00:00Z'
      })
    ).toEqual({ valor: 50 });
    expect(
      alcanceRecebido(local, marcadorMs, {
        reach_char_count: 10,
        modified_at: '2026-10-21T10:00:00Z'
      })
    ).toEqual({ valor: 30 });
  });

  it('desmarcar aqui depois da linha vence o maior', () => {
    const local = { valor: 10, baixadoEm: t('2026-10-21T10:30:00Z') };

    expect(
      alcanceRecebido(local, t('2026-10-21T11:00:00Z'), {
        reach_char_count: 50,
        modified_at: '2026-10-21T10:00:00Z'
      })
    ).toEqual(local);
  });
});

describe('conversões', () => {
  it('marcador vai e volta, com progresso em número ou em %', () => {
    const marcador = {
      dataId: 7,
      progress: 0.42,
      scrollX: 0,
      scrollY: 1234.5,
      exploredCharCount: 4200,
      lastBookmarkModified: t('2026-10-21T10:00:00Z')
    };
    const linha = marcadorParaLinha('hash', marcador, 5000, aparelho);

    expect(linha).toMatchObject({
      book_id: 'hash',
      progress: '0.42',
      reach_char_count: 5000,
      device_id: 'ap-1',
      device_name: 'iPad',
      modified_at: '2026-10-21T10:00:00.000Z',
      deleted_at: null
    });
    expect(linhaParaMarcador(linha as LinhaMarcador, 7)).toEqual(marcador);

    const emPorcentagem = marcadorParaLinha('h', { ...marcador, progress: '42%' }, 0, aparelho);

    expect(linhaParaMarcador(emPorcentagem as LinhaMarcador, 7).progress).toBe('42%');
  });

  it('estatística vai e volta com o livro concluído', () => {
    const estatistica = {
      title: 'Livro',
      dateKey: '2026-10-21',
      charactersRead: 1200,
      readingTime: 600,
      minReadingSpeed: 100,
      altMinReadingSpeed: 120,
      lastReadingSpeed: 7200,
      maxReadingSpeed: 8000,
      lastStatisticModified: t('2026-10-21T10:00:00Z'),
      completedBook: 1,
      completedData: {
        dateKey: '2026-10-21',
        charactersRead: 1,
        readingTime: 2,
        minReadingSpeed: 3,
        altMinReadingSpeed: 4,
        lastReadingSpeed: 5,
        maxReadingSpeed: 6
      }
    };
    const linha = estatisticaParaLinha('hash', estatistica, aparelho);

    expect(linha).toMatchObject({ book_id: 'hash', device_id: 'ap-1', completed_book: true });
    expect(linhaParaEstatistica(linha as LinhaEstatistica, 'Livro')).toEqual(estatistica);

    const semConclusao = { ...estatistica };
    delete (semConclusao as Partial<typeof estatistica>).completedBook;
    delete (semConclusao as Partial<typeof estatistica>).completedData;

    expect(
      linhaParaEstatistica(
        estatisticaParaLinha('hash', semConclusao, aparelho) as LinhaEstatistica,
        'Livro'
      )
    ).toEqual(semConclusao);
  });

  it('meta vai e volta, com fim vazio para a meta aberta', () => {
    const meta = {
      goalStartDate: '2026-10-20',
      goalEndDate: '',
      goalOriginalEndDate: '',
      goalFrequency: ReadingGoalFrequency.WEEKLY,
      timeGoal: 3600,
      characterGoal: 0,
      lastGoalModified: t('2026-10-21T10:00:00Z')
    };
    const linha = metaParaLinha(meta);

    expect(linha).toMatchObject({ goal_end_date: null, goal_frequency: 'weekly' });
    expect(linhaParaMeta(linha as LinhaMeta)).toEqual(meta);
  });

  it('horário em ISO', () => {
    expect(paraIso(0)).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('pergunta do marcador de outro aparelho', () => {
  it('diz o aparelho, o capítulo e a porcentagem', () => {
    const livro = {
      characters: 1000,
      sections: [
        { startCharacter: 0 },
        { startCharacter: 100 },
        { startCharacter: 150, parentChapter: 'c2' },
        { startCharacter: 400 }
      ]
    };

    expect(textoMarcadorRemoto({ device_name: 'iPad', explored_char_count: 420 }, livro)).toBe(
      'Você parou no iPad, cap. 3 (42%). Ir para lá?'
    );
    expect(textoMarcadorRemoto({ device_name: null, explored_char_count: null }, livro)).toBe(
      'Você parou no outro aparelho, cap. 1 (0%). Ir para lá?'
    );
    expect(
      textoMarcadorRemoto({ device_name: 'iPhone', explored_char_count: 50 }, { characters: 0 })
    ).toBe('Você parou no iPhone (0%). Ir para lá?');
  });
});

describe('aparelho e arquivos', () => {
  it('reconhece iPhone, iPad (inclusive o que se diz Mac), Windows', () => {
    expect(nomeDoAparelho('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(
      'iPhone'
    );
    expect(nomeDoAparelho('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('iPad');
    expect(nomeDoAparelho('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('Mac');
    expect(nomeDoAparelho('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('Windows');
  });

  it('pastas do livro no bucket ficam dentro da pasta do usuário', () => {
    expect(caminhosDoLivro('u1', 'abc')).toEqual({
      processado: 'u1/abc/processado.zip',
      original: 'u1/abc/original.epub',
      capa: 'u1/abc/capa'
    });
  });

  it('hash SHA-256 em hexadecimal', async () => {
    const dados = new TextEncoder().encode('abc');

    expect(await hashDoArquivo(dados.buffer as ArrayBuffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});
