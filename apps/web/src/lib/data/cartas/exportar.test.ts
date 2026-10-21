/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import type { LinhaCarta, LinhaLote } from '$lib/data/supabase/sincronizacao/regras';
import {
  audiosParaApagar,
  cartasExportaveis,
  estimarBytes,
  nomeDaMidia,
  notaDaCarta
} from './exportar';

const carta = (id: string, mudancas: Partial<LinhaCarta> = {}): LinhaCarta =>
  ({
    id,
    book_id: 'livro',
    word: '気のせい',
    word_reading: 'きのせい',
    word_meaning: 'impressão minha',
    word_furigana: '気[き]のせい',
    word_audio_path: `u1/leituras-${id}p.wav`,
    sentence: '最初は<b>気のせい</b>だと思った。',
    sentence_meaning: 'No começo achei que era impressão minha.',
    sentence_furigana: '最[さい] 初[しょ]は<b>気[き]のせい</b>だと 思[おも]った。',
    sentence_audio_path: `u1/leituras-${id}f.wav`,
    notes: null,
    frequency: 9000,
    state: 'gerada',
    lote_id: null,
    modified_at: '2026-10-21T10:00:00.000Z',
    deleted_at: null,
    ...mudancas
  }) as LinhaCarta;

const lote = (id: string, exportado: string, mudancas: Partial<LinhaLote> = {}): LinhaLote =>
  ({
    id,
    exported_at: exportado,
    device_id: 'ap',
    device_name: 'iPhone',
    audio_deleted_at: null,
    confirmed_in_anki_at: null,
    modified_at: exportado,
    deleted_at: null,
    ...mudancas
  }) as LinhaLote;

describe('nota do .apkg a partir da carta (CARDS.md)', () => {
  it('14 campos, áudio como [sound:], etiquetas do livro', () => {
    const { nota, midias } = notaDaCarta(carta('c1'), 'また、同じ夢を見ていた');

    expect(nota.campos).toEqual({
      Word: '気のせい',
      'Word Reading': 'きのせい',
      'Word Meaning': 'impressão minha',
      'Word Furigana': '気[き]のせい',
      'Word Audio': '[sound:leituras-c1p.wav]',
      Sentence: '最初は<b>気のせい</b>だと思った。',
      'Sentence Meaning': 'No começo achei que era impressão minha.',
      'Sentence Furigana': '最[さい] 初[しょ]は<b>気[き]のせい</b>だと 思[おも]った。',
      'Sentence Audio': '[sound:leituras-c1f.wav]',
      Notes: '',
      'Pitch Accent': '',
      'Pitch Accent Notes': '',
      Frequency: '9000',
      Picture: ''
    });
    expect(nota.etiquetas).toEqual(['dokusho', 'dokusho::また、同じ夢を見ていた']);
    expect(midias).toEqual([
      { nome: 'leituras-c1p.wav', caminho: 'u1/leituras-c1p.wav' },
      { nome: 'leituras-c1f.wav', caminho: 'u1/leituras-c1f.wav' }
    ]);
  });

  it('carta com erro entra sem o áudio que faltou; livro desconhecido fica só com dokusho', () => {
    const { nota, midias } = notaDaCarta(
      carta('c2', { state: 'erro', sentence_audio_path: null, frequency: null }),
      undefined
    );

    expect(nota.campos['Sentence Audio']).toBe('');
    expect(nota.campos.Frequency).toBe('');
    expect(nota.etiquetas).toEqual(['dokusho']);
    expect(midias).toHaveLength(1);
  });

  it('nome da mídia é o do arquivo no bucket', () => {
    expect(nomeDaMidia('u1/leituras-0123456789ab.wav')).toBe('leituras-0123456789ab.wav');
  });
});

describe('o que entra no Lote', () => {
  it('só as geradas ainda não exportadas; com erro, só se escolher', () => {
    const cartas = [
      carta('a'),
      carta('b', { state: 'exportada', lote_id: 'l1' }),
      carta('c', { state: 'erro' }),
      carta('d', { state: 'pendente' }),
      carta('e', { deleted_at: '2026-10-21T10:00:00.000Z' })
    ];

    expect(cartasExportaveis(cartas, false).map((c) => c.id)).toEqual(['a']);
    expect(cartasExportaveis(cartas, true).map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('tamanho estimado pelos áudios presentes (R5: 36 KB palavra, 279 KB frase)', () => {
    expect(estimarBytes([carta('a')])).toBe(36_000 + 279_000);
    expect(estimarBytes([carta('b', { sentence_audio_path: null })])).toBe(36_000);
  });
});

describe('áudio sai do bucket 30 dias depois do Lote baixado', () => {
  const agora = Date.parse('2026-12-01T00:00:00Z');

  it('apaga os áudios das cartas de Lotes com mais de 30 dias', () => {
    const lotes = [lote('velho', '2026-10-01T00:00:00Z'), lote('novo', '2026-11-20T00:00:00Z')];
    const cartas = [
      carta('a', { state: 'exportada', lote_id: 'velho' }),
      carta('b', { state: 'exportada', lote_id: 'novo' })
    ];

    expect(audiosParaApagar(lotes, cartas, agora)).toEqual([
      { lote: lotes[0], caminhos: ['u1/leituras-ap.wav', 'u1/leituras-af.wav'] }
    ]);
  });

  it('não apaga o arquivo que outra carta ainda usa (mesmo áudio), nem Lote já limpo', () => {
    const lotes = [
      lote('velho', '2026-10-01T00:00:00Z'),
      lote('limpo', '2026-09-01T00:00:00Z', { audio_deleted_at: '2026-10-02T00:00:00Z' })
    ];
    const cartas = [
      carta('a', { state: 'exportada', lote_id: 'velho' }),
      // Mesma palavra criada de novo: mesmo nome de áudio, ainda na fila.
      carta('b', {
        word_audio_path: 'u1/leituras-ap.wav',
        sentence_audio_path: 'u1/outra.wav'
      }),
      carta('c', { state: 'exportada', lote_id: 'limpo' })
    ];

    expect(audiosParaApagar(lotes, cartas, agora)).toEqual([
      { lote: lotes[0], caminhos: ['u1/leituras-af.wav'] }
    ]);
  });
});
