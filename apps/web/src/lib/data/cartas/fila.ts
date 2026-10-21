/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BehaviorSubject } from 'rxjs';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '$lib/data/supabase/client';
import { mensagemDaFuncao } from '$lib/data/supabase/erro-da-funcao';
import { sincronizador, sincronizarAgora } from '$lib/data/supabase/sincronizacao/iniciar';
import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';
import { criarGeracao, type RespostaGerar } from './geracao';

// A Fila de cartas no app: geração pela Edge Function `gemini` e o que a tela da Fila e o painel
// usam (V1.5).

/** Id da carta que está sendo gerada agora (a Fila mostra "gerando"). */
export const gerandoAgora$ = new BehaviorSubject<string | undefined>(undefined);

async function invocar(id: string, refazer?: ('texto' | 'audio')[]): Promise<RespostaGerar> {
  const { data: sessao } = await supabase.auth.getSession();

  if (!sessao.session) throw new Error('Entre na conta para gerar as cartas');

  gerandoAgora$.next(id);

  try {
    const { data, error } = await supabase.functions.invoke<RespostaGerar>('gemini', {
      body: { action: 'generate', id, ...(refazer ? { refazer } : {}) }
    });

    if (error instanceof FunctionsHttpError && error.context?.status === 409) {
      return { estado: 'ocupada' };
    }

    if (error) throw new Error(await mensagemDaFuncao(error));
    if (!data) throw new Error('A função não respondeu');

    return data;
  } finally {
    gerandoAgora$.next(undefined);
  }
}

export const geracao = criarGeracao({
  listar: () => sincronizador().listar('cartas'),
  ler: (id) => sincronizador().ler('cartas', id),
  salvar: (carta) => sincronizador().salvar('cartas', carta),
  sincronizar: sincronizarAgora,
  invocar,
  online: () => navigator.onLine,
  agora: () => new Date().toISOString()
});

/** Gera o que está pendente, sem deixar um erro de rede ou de login escapar. */
export function gerarPendentes() {
  geracao.processarFila().catch(() => undefined);
}

export async function salvarCarta(carta: LinhaCarta) {
  await sincronizador().salvar('cartas', { ...carta, modified_at: new Date().toISOString() });
}

/** Tira da fila: soft delete (ESCOPO "Cards": "Você pode tirá-la da fila"). */
export async function tirarDaFila(carta: LinhaCarta) {
  const agora = new Date().toISOString();

  await sincronizador().salvar('cartas', { ...carta, modified_at: agora, deleted_at: agora });
}

/** URL temporária de um áudio do bucket `audio`. */
export async function urlDoAudio(caminho: string) {
  const { data, error } = await supabase.storage.from('audio').createSignedUrl(caminho, 3600);

  if (error || !data) throw new Error(error?.message || 'Áudio não encontrado');

  return data.signedUrl;
}

/** A Frase com o negrito da palavra, e mais nada do HTML (o texto vem do livro). */
export function htmlDaFrase(frase: string) {
  return frase
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>');
}
