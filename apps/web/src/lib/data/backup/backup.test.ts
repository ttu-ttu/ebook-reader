/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  CHAVES_DO_BACKUP,
  TABELAS_DO_BACKUP,
  arquivosDoBackup,
  diasDesde,
  lerBackup,
  linhasParaRestaurar
} from './backup';

describe('backup (ESCOPO "Backup")', () => {
  it('uma tabela por arquivo JSON e um manifesto com a contagem', () => {
    const arquivos = arquivosDoBackup(
      { books: [{ id: 'a' }], batch_items: [{ id: 'c1' }, { id: 'c2' }] },
      '2026-10-21T10:00:00.000Z'
    );

    expect(arquivos.map(([nome]) => nome)).toEqual([
      'manifesto.json',
      'books.json',
      'batch_items.json'
    ]);
    expect(JSON.parse(arquivos[0][1])).toEqual({
      formato: 1,
      criadoEm: '2026-10-21T10:00:00.000Z',
      linhas: { books: 1, batch_items: 2 }
    });
  });

  it('lê de volta e recusa o que não é backup do Dokusho', () => {
    const arquivos = new Map(arquivosDoBackup({ books: [{ id: 'a' }] }, 'x'));

    expect(lerBackup(arquivos)).toEqual({ criadoEm: 'x', tabelas: { books: [{ id: 'a' }] } });
    expect(() => lerBackup(new Map([['outro.json', '{}']]))).toThrow('não é um backup');
  });

  it('restaurar troca o dono para o usuário atual e deixa o updated_at para o servidor', () => {
    expect(
      linhasParaRestaurar(
        [{ id: 'a', user_id: 'velho', updated_at: '2026-01-01', modified_at: '2026-01-01' }],
        'novo'
      )
    ).toEqual([{ id: 'a', user_id: 'novo', modified_at: '2026-01-01' }]);
  });

  it('todas as tabelas do app, com a chave de cada uma', () => {
    expect(TABELAS_DO_BACKUP).toEqual([
      'books',
      'bookmarks',
      'reading_stats',
      'reading_goals',
      'vocab',
      'vocab_history',
      'translations',
      'lotes',
      'batch_items'
    ]);
    expect(CHAVES_DO_BACKUP.vocab).toBe('user_id,word,reading');
  });

  it('"último backup: há N dias"', () => {
    const dia = 86_400_000;

    expect(diasDesde(0, 3 * dia + 5)).toBe(3);
    expect(diasDesde(undefined, dia)).toBeUndefined();
  });
});
