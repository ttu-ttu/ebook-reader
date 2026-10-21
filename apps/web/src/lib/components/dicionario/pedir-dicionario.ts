/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import BaixarDicionarioDialog from '$lib/components/dicionario/baixar-dicionario-dialog.svelte';
import { dialogManager } from '$lib/data/dialog-manager';
import { verificarDicionario } from '$lib/data/dicionario/servico';

/**
 * Garante o dicionário neste aparelho: se não está gravado, mostra o aviso de tamanho e baixa.
 * true quando está pronto para consultar.
 */
export async function pedirDicionario() {
  if (await verificarDicionario()) return true;

  return new Promise<boolean>((resolver) => {
    dialogManager.dialogs$.next([
      {
        component: BaixarDicionarioDialog,
        props: { resolver },
        disableCloseOnClick: true
      }
    ]);
  });
}
