/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * A mensagem que a Edge Function `gemini` mandou (`{ erro }`), em vez do genérico "Edge Function
 * returned a non-2xx status code" do supabase-js (ex.: "teto diário de 300 chamadas atingido").
 */
export async function mensagemDaFuncao(erro: unknown) {
  if (erro instanceof FunctionsHttpError) {
    const corpo = await erro.context
      ?.clone?.()
      .json()
      .catch(() => undefined);

    if (corpo?.erro) return String(corpo.erro);
    if (corpo?.motivo) return String(corpo.motivo);
  }

  return erro instanceof Error ? erro.message : String(erro);
}
