/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { DokushoSupabaseClient } from '$lib/data/supabase/create-client';
import { gravarDicionario, versaoGravada, type BancoDicionario } from './banco';
import type { Cabecalho } from './formato';

// Download do dicionário preparado pelo tools/ (ADR 0004) a partir do bucket privado `dicts`.

/** O que o tools/subir-dicionario.ts grava em <user_id>/dicionario/atual.json. */
export interface DicionarioAtual extends Cabecalho {
  caminho: string;
  arquivo: string;
  bytes: number;
  bytesDescompactado: number;
  sha256: string;
  geradoEm: string;
}

export async function* linhasDoFluxo(fluxo: ReadableStream<string>) {
  const leitor = fluxo.getReader();
  let resto = '';
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    const partes = (resto + value).split('\n');
    resto = partes.pop()!;
    for (const linha of partes) if (linha) yield linha;
  }
  if (resto) yield resto;
}

export async function lerDicionarioAtual(supabase: DokushoSupabaseClient) {
  const { data: sessao } = await supabase.auth.getSession();
  const usuario = sessao.session?.user.id;
  if (!usuario) throw new Error('Entre na conta para baixar o dicionário');
  // atual.json sobe com cacheControl 0.
  const { data, error } = await supabase.storage
    .from('dicts')
    .download(`${usuario}/dicionario/atual.json`);
  if (error) throw error;
  return JSON.parse(await data.text()) as DicionarioAtual;
}

/** Baixa o arquivo inteiro, contando os bytes. */
export async function baixarArquivo(
  supabase: DokushoSupabaseClient,
  atual: DicionarioAtual,
  aoBaixar?: (bytes: number, total: number) => void
) {
  const { data, error } = await supabase.storage.from('dicts').createSignedUrl(atual.caminho, 600);
  if (error) throw error;
  const resposta = await fetch(data.signedUrl);
  if (!resposta.ok || !resposta.body) throw new Error(`Dicionário: HTTP ${resposta.status}`);
  const leitor = resposta.body.getReader();
  const pedacos: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    pedacos.push(value);
    bytes += value.byteLength;
    aoBaixar?.(bytes, atual.bytes);
  }
  return new Blob(pedacos as BlobPart[], { type: 'application/gzip' });
}

/** Descompacta e grava no IndexedDB, em fluxo. */
export function prepararArquivo(
  db: BancoDicionario,
  arquivo: Blob,
  aoProgredir?: (fracao: number) => void
) {
  const texto = arquivo
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .pipeThrough(new TextDecoderStream());
  return gravarDicionario(db, linhasDoFluxo(texto), aoProgredir);
}

export async function dicionarioEmDia(db: BancoDicionario, atual: DicionarioAtual) {
  return (await versaoGravada(db)) === atual.versao;
}
