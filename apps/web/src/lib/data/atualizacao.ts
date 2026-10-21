/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BehaviorSubject } from 'rxjs';

// Nova versão do app (ADR 0011): o service worker novo fica esperando; o aviso "Nova versão:
// atualizar" aparece fora do leitor, e o toque pede a troca e recarrega.

export const novaVersao$ = new BehaviorSubject(false);

const VERIFICAR_A_CADA = 60 * 60_000;

let registro: ServiceWorkerRegistration | undefined;
let iniciado = false;

function acompanhar(novo: ServiceWorker | null) {
  if (!novo) return;

  // Já existe uma versão ativa: a nova, instalada, fica esperando o aviso.
  const avisar = () => {
    if (novo.state === 'installed' && navigator.serviceWorker.controller) novaVersao$.next(true);
  };

  avisar();
  novo.addEventListener('statechange', avisar);
}

export async function iniciarAtualizacao() {
  if (iniciado || !('serviceWorker' in navigator)) return;

  iniciado = true;
  registro = await navigator.serviceWorker.getRegistration();

  if (!registro) return;

  acompanhar(registro.waiting);
  registro.addEventListener('updatefound', () => acompanhar(registro?.installing ?? null));

  const verificar = () => registro?.update().catch(() => undefined);

  setInterval(verificar, VERIFICAR_A_CADA);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verificar();
  });
}

/** "Nova versão: atualizar": ativa a versão que espera e recarrega quando ela assume. */
export function atualizarAgora() {
  const esperando = registro?.waiting;

  if (!esperando) {
    window.location.reload();
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true
  });
  esperando.postMessage({ type: 'ATUALIZAR' });
}
