/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BehaviorSubject, Subject } from 'rxjs';
import { getCurrentReadingGoal } from '$lib/data/reading-goal';
import { StorageKey } from '$lib/data/storage/storage-types';
import { database, readingGoal$ } from '$lib/data/store';
import { supabase } from '$lib/data/supabase/client';
import { abrirBancoSinc } from './banco';
import { nomeDoAparelho, type Aparelho } from './regras';
import { servidorSupabase } from './servidor-supabase';
import { Sincronizador } from './sincronizador';

// Liga o sincronizador ao app: quando roda e o que avisa à interface depois de receber.

export type EstadoSinc =
  | { tipo: 'parado'; quando?: number }
  | { tipo: 'sincronizando' }
  | { tipo: 'sem-login' }
  | { tipo: 'offline' }
  | { tipo: 'erro'; mensagem: string };

export const estadoSinc$ = new BehaviorSubject<EstadoSinc>({ tipo: 'parado' });

/** Estatísticas de outro aparelho chegaram (a tela inicial soma). */
export const estatisticasRecebidas$ = new Subject<void>();

/** Cartas, Lotes ou traduções chegaram do servidor (a Fila e o painel releem). */
export const cartasRecebidas$ = new Subject<void>();

const CHAVE_APARELHO = 'dokusho-aparelho';
const ESPERA_DEPOIS_DE_MUDAR = 15_000;
const INTERVALO_EM_PRIMEIRO_PLANO = 5 * 60_000;

let instancia: Sincronizador | undefined;
let agendado: ReturnType<typeof setTimeout> | undefined;
let iniciado = false;

function aparelho(): Aparelho {
  let id = '';

  try {
    id = localStorage.getItem(CHAVE_APARELHO) || '';

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CHAVE_APARELHO, id);
    }
  } catch {
    id = id || crypto.randomUUID();
  }

  return { id, nome: nomeDoAparelho(navigator.userAgent, navigator.maxTouchPoints || 0) };
}

async function atualizarListaDeLivros() {
  // Import tardio: os handlers importam o replicator, que importa este arquivo.
  const { getStorageHandler } = await import('$lib/data/storage/storage-handler-factory');

  getStorageHandler(window, StorageKey.BROWSER).clearData();
  database.dataListChanged$.next(undefined);
}

export function sincronizador() {
  if (!instancia) {
    instancia = new Sincronizador({
      ttu: database.db,
      sinc: abrirBancoSinc(),
      servidor: () => servidorSupabase(supabase),
      aparelho: aparelho(),
      avisos: {
        livros: atualizarListaDeLivros,
        marcadores: () => database.bookmarksChanged$.next(),
        metas: async () => readingGoal$.next(await getCurrentReadingGoal()),
        estatisticas: () => estatisticasRecebidas$.next(),
        cartas: () => cartasRecebidas$.next()
      },
      apagarLivroLocal: async (dataId) => {
        const livro = await database.getData(dataId);

        await database.deleteData(
          [dataId],
          new Map([[dataId, livro?.title || '']]),
          new AbortController().signal,
          true
        );
        await atualizarListaDeLivros();
      }
    });
  }

  return instancia;
}

export async function sincronizarAgora() {
  clearTimeout(agendado);
  agendado = undefined;

  if (!navigator.onLine) {
    estadoSinc$.next({ tipo: 'offline' });
    return;
  }

  estadoSinc$.next({ tipo: 'sincronizando' });

  try {
    const resultado = await sincronizador().sincronizar();

    estadoSinc$.next(
      resultado === 'sem-login' ? { tipo: 'sem-login' } : { tipo: 'parado', quando: Date.now() }
    );
  } catch (erro) {
    estadoSinc$.next({
      tipo: 'erro',
      mensagem: erro instanceof Error ? erro.message : String(erro)
    });
  }
}

/** Depois de mudar algo aqui: sobe em até ~15 s (ESCOPO "Marcador"), sem reiniciar a espera. */
export function sincronizarEmBreve() {
  if (agendado) return;

  agendado = setTimeout(sincronizarAgora, ESPERA_DEPOIS_DE_MUDAR);
}

export function iniciarSincronizacao() {
  if (iniciado) return;

  iniciado = true;

  navigator.storage?.persist?.().catch(() => undefined);

  database.mudou$.subscribe(sincronizarEmBreve);

  window.addEventListener('online', sincronizarAgora);

  // Ao ir para segundo plano envia logo (no iOS o envio na saída muitas vezes não chega); ao
  // voltar, recebe o que os outros aparelhos mudaram.
  document.addEventListener('visibilitychange', sincronizarAgora);

  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_IN') sincronizarAgora();
  });

  setInterval(() => {
    if (document.visibilityState === 'visible') sincronizarAgora();
  }, INTERVALO_EM_PRIMEIRO_PLANO);

  sincronizarAgora();
}
