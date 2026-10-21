/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { supabase } from '$lib/data/supabase/client';
import { mensagemDaFuncao } from '$lib/data/supabase/erro-da-funcao';
import { sincronizador } from '$lib/data/supabase/sincronizacao/iniciar';
import { hashDoArquivo } from '$lib/data/supabase/sincronizacao/regras';

// "Traduzir frase" do painel (ESCOPO "Toque e painel"): primeiro o cache local das traduções
// (sincronizado da tabela translations), depois a ação `translate` da Edge Function `gemini`, que
// também guarda no cache. A carta reaproveita a tradução já pedida.

const semHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

/** Mesma chave da função (textos.ts: SHA-256 da frase sem HTML, sem espaços nas pontas). */
export async function chaveDaFrase(frase: string) {
  const bytes = new TextEncoder().encode(semHtml(frase).trim());

  return hashDoArquivo(bytes.buffer as ArrayBuffer);
}

export async function traducaoEmCache(frase: string) {
  return (await sincronizador().ler('traducoes', await chaveDaFrase(frase)))?.translation;
}

export async function traduzirFrase(frase: string, antes?: string, depois?: string) {
  const emCache = await traducaoEmCache(frase);

  if (emCache) return { traducao: emCache, cache: true };

  const { data, error } = await supabase.functions.invoke<{ traducao: string; cache: boolean }>(
    'gemini',
    { body: { action: 'translate', frase, antes, depois } }
  );

  if (error) throw new Error(await mensagemDaFuncao(error));
  if (!data?.traducao) throw new Error('A tradução não chegou');

  return data;
}
