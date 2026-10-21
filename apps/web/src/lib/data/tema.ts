/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BehaviorSubject } from 'rxjs';

// Tema das telas do Dokusho (como no protótipo D1): segue o sistema, ou fica claro ou escuro. O
// app.html aplica antes de desenhar (sem piscar claro); aqui é a escolha nas Configurações.

export type Tema = 'sistema' | 'claro' | 'escuro';

export const CHAVE_TEMA = 'dokusho-tema';

function lido(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE_TEMA);

    return valor === 'claro' || valor === 'escuro' ? valor : 'sistema';
  } catch {
    return 'sistema';
  }
}

export const tema$ = new BehaviorSubject<Tema>(typeof window === 'undefined' ? 'sistema' : lido());

export function escolherTema(tema: Tema) {
  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // Sem localStorage, vale só nesta sessão.
  }

  if (tema === 'sistema') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;

  tema$.next(tema);
}
