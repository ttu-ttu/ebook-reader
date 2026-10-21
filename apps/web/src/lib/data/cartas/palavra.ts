/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { Entrada, Forma, PedacoFurigana } from '$lib/data/dicionario/formato';
import { paraHiragana, type Pedaco } from '$lib/data/dicionario/tokenizador';
import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';
import { comNegrito, contextoDaFrase, fraseEm } from './frase';
import { furiganaDaFrase, furiganaDaPalavra, type FuriganaDoDicionario } from './furigana';

// A Palavra no painel e a parte local da Carta (ADR 0010): o que vem do dicionário e do livro,
// preenchido na hora, mesmo offline. O Gemini completa o resto pela Edge Function.

const temLeitura = (entrada: Entrada, leitura: string) =>
  entrada.formas.some((forma) => paraHiragana(forma.l) === leitura);

/**
 * Entradas do painel: a que bate com a leitura preferida (o furigana do EPUB) primeiro, depois a
 * ordem que já vem (frequência do JPDB).
 */
export function ordenarEntradas(entradas: Entrada[], leituraPreferida?: string) {
  if (!leituraPreferida) return entradas;

  const leitura = paraHiragana(leituraPreferida);

  return [
    ...entradas.filter((entrada) => temLeitura(entrada, leitura)),
    ...entradas.filter((entrada) => !temLeitura(entrada, leitura))
  ];
}

const usualmenteKana = (entrada: Entrada) => entrada.sentidos[0]?.t.includes('uk') ?? false;

const frequenciaDa = (forma: Forma) => forma.f ?? forma.fk;

const maisFrequente = (formas: Forma[]) =>
  [...formas].sort((a, b) => (frequenciaDa(a) ?? Infinity) - (frequenciaDa(b) ?? Infinity))[0];

/**
 * Word e Word Reading da entrada aberta: a escrita do texto quando o dicionário a tem; texto em
 * kana pega a escrita mais frequente com aquela leitura (わかる → 分かる), salvo palavra "usually
 * kana" no JMdict, que fica em kana.
 */
export function formaDaEntrada(entrada: Entrada, termo: string, leituraPreferida?: string) {
  const preferida = leituraPreferida && paraHiragana(leituraPreferida);
  const kana = paraHiragana(termo);
  const daEscrita = entrada.formas.filter((forma) => forma.e === termo);
  const daLeitura = entrada.formas.filter((forma) => paraHiragana(forma.l) === kana);
  const candidatas = daEscrita.length ? daEscrita : daLeitura.length ? daLeitura : entrada.formas;
  const forma =
    (preferida && candidatas.find((f) => paraHiragana(f.l) === preferida)) ||
    maisFrequente(candidatas) ||
    entrada.formas[0];
  const leitura = paraHiragana(forma.l);
  const escrita = usualmenteKana(entrada) && !daEscrita.length ? forma.l : forma.e;

  return {
    escrita,
    leitura,
    forma,
    frequencia: frequenciaDa(forma),
    furigana: escrita === forma.e ? forma.fu : undefined
  };
}

export interface DadosDaCarta {
  id: string;
  /** ISO do horário do aparelho (modified_at). */
  agora: string;
  livroId: string;
  /** Entrada aberta no painel; undefined quando a palavra não está no dicionário. */
  entrada?: Entrada;
  /** Termo consultado (forma de dicionário) ou a seleção, fora do dicionário. */
  termo: string;
  leituraPreferida?: string;
  /** Texto do parágrafo (sem furigana do EPUB) e a palavra nele: [inicio, fim). */
  paragrafo: string;
  inicio: number;
  fim: number;
  paragrafoAnterior?: string;
  paragrafoSeguinte?: string;
  tokenizar: (texto: string) => Pedaco[];
  furiganaDoDicionario?: FuriganaDoDicionario;
}

export async function montarCarta(dados: DadosDaCarta): Promise<LinhaCarta> {
  const frase = fraseEm(dados.paragrafo, dados.inicio, dados.fim);
  const contexto = contextoDaFrase(
    dados.paragrafo,
    frase,
    dados.paragrafoAnterior,
    dados.paragrafoSeguinte
  );
  const palavra = dados.entrada
    ? formaDaEntrada(dados.entrada, dados.termo, dados.leituraPreferida)
    : undefined;
  const escrita = palavra?.escrita ?? dados.termo;
  const leitura = palavra?.leitura ?? paraHiragana(dados.termo);
  const fu: PedacoFurigana[] | undefined = palavra?.furigana;
  const sentenceFurigana = await furiganaDaFrase(
    frase.frase,
    dados.tokenizar(frase.frase),
    frase.inicio,
    frase.fim,
    dados.furiganaDoDicionario
  );

  return {
    id: dados.id,
    user_id: '',
    book_id: dados.livroId,
    jmdict_id: dados.entrada?.seq ?? null,
    word: escrita,
    word_reading: leitura,
    word_furigana: furiganaDaPalavra(escrita, leitura, fu),
    word_meaning: null,
    word_audio_path: null,
    word_audio_check: null,
    sentence: comNegrito(frase),
    sentence_furigana: sentenceFurigana,
    sentence_meaning: null,
    sentence_audio_path: null,
    sentence_before: contexto.antes || null,
    sentence_after: contexto.depois || null,
    notes: null,
    frequency: palavra?.frequencia ?? null,
    voice_text: null,
    state: 'pendente',
    error_reason: null,
    lote_id: null,
    modified_at: dados.agora,
    updated_at: dados.agora,
    deleted_at: null
  };
}
