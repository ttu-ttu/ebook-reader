/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { NotaApkg } from '$lib/functions/anki/apkg';
import { DECK, etiquetasDoLivro, type CamposCarta } from '$lib/functions/anki/modelo';
import type { LinhaCarta, LinhaLote } from '$lib/data/supabase/sincronizacao/regras';

// Exportação .apkg (V1.6; ESCOPO "Regras da fila"): as cartas geradas e ainda não exportadas viram
// um Lote. O áudio sai do bucket 30 dias depois do Lote baixado.

/** R5: voz da palavra ~36 KB, voz da frase ~279 KB (WAV). */
const BYTES_AUDIO_PALAVRA = 36_000;
const BYTES_AUDIO_FRASE = 279_000;
const DIAS_DO_AUDIO = 30;

export const nomeDaMidia = (caminho: string) => caminho.split('/').pop() ?? caminho;

export function cartasExportaveis(cartas: LinhaCarta[], incluirErro: boolean) {
  return cartas.filter(
    (carta) =>
      !carta.deleted_at &&
      !carta.lote_id &&
      (carta.state === 'gerada' || (incluirErro && carta.state === 'erro'))
  );
}

export function estimarBytes(cartas: LinhaCarta[]) {
  return cartas.reduce(
    (soma, carta) =>
      soma +
      (carta.word_audio_path ? BYTES_AUDIO_PALAVRA : 0) +
      (carta.sentence_audio_path ? BYTES_AUDIO_FRASE : 0),
    0
  );
}

/** A nota do .apkg (14 campos do CARDS.md) e os áudios que ela usa. */
export function notaDaCarta(carta: LinhaCarta, tituloDoLivro: string | undefined) {
  const midias = [carta.word_audio_path, carta.sentence_audio_path]
    .filter((caminho): caminho is string => !!caminho)
    .map((caminho) => ({ nome: nomeDaMidia(caminho), caminho }));
  const som = (caminho: string | null) => (caminho ? `[sound:${nomeDaMidia(caminho)}]` : '');
  const campos: CamposCarta = {
    Word: carta.word,
    'Word Reading': carta.word_reading,
    'Word Meaning': carta.word_meaning ?? '',
    'Word Furigana': carta.word_furigana ?? '',
    'Word Audio': som(carta.word_audio_path),
    Sentence: carta.sentence,
    'Sentence Meaning': carta.sentence_meaning ?? '',
    'Sentence Furigana': carta.sentence_furigana ?? '',
    'Sentence Audio': som(carta.sentence_audio_path),
    Notes: carta.notes ?? '',
    'Pitch Accent': '',
    'Pitch Accent Notes': '',
    Frequency: carta.frequency === null ? '' : String(carta.frequency),
    Picture: ''
  };
  const nota: NotaApkg = {
    campos,
    etiquetas: tituloDoLivro ? etiquetasDoLivro(tituloDoLivro) : [DECK.tag]
  };

  return { nota, midias };
}

/**
 * Lotes com mais de 30 dias cujo áudio ainda está no bucket, com os arquivos a apagar: os das
 * cartas do Lote que nenhuma outra carta (na fila, ou de um Lote mais novo) ainda usa.
 */
export function audiosParaApagar(lotes: LinhaLote[], cartas: LinhaCarta[], agora: number) {
  const limite = agora - DIAS_DO_AUDIO * 86_400_000;
  const velhos = new Set(
    lotes
      .filter(
        (lote) =>
          !lote.deleted_at && !lote.audio_deleted_at && Date.parse(lote.exported_at) < limite
      )
      .map((lote) => lote.id)
  );
  const caminhos = (carta: LinhaCarta) =>
    [carta.word_audio_path, carta.sentence_audio_path].filter((c): c is string => !!c);
  const emUso = new Set(
    cartas
      .filter((carta) => !carta.deleted_at && !(carta.lote_id && velhos.has(carta.lote_id)))
      .flatMap(caminhos)
  );

  return lotes
    .filter((lote) => velhos.has(lote.id))
    .map((lote) => ({
      lote,
      caminhos: [
        ...new Set(
          cartas
            .filter((carta) => carta.lote_id === lote.id)
            .flatMap(caminhos)
            .filter((caminho) => !emUso.has(caminho))
        )
      ]
    }));
}
