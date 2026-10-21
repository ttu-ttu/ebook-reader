/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { DokushoSupabaseClient } from '$lib/data/supabase/create-client';
import type { Linhas, Servidor, TabelaSinc } from './sincronizador';

// O Servidor do sincronizador sobre o Supabase: tabelas com RLS e o bucket `epubs`.

const CONFLITO: Record<TabelaSinc, string> = {
  books: 'user_id,id',
  bookmarks: 'user_id,book_id',
  reading_stats: 'user_id,book_id,date_key,device_id',
  reading_goals: 'user_id,goal_start_date',
  batch_items: 'user_id,id',
  lotes: 'user_id,id',
  translations: 'user_id,sentence_sha256'
};

const CHAVE: Record<TabelaSinc, string[]> = {
  books: ['id'],
  bookmarks: ['book_id'],
  reading_stats: ['book_id', 'date_key', 'device_id'],
  reading_goals: ['goal_start_date'],
  batch_items: ['id'],
  lotes: ['id'],
  translations: ['sentence_sha256']
};

const POR_ENVIO = 500;

export async function servidorSupabase(
  cliente: DokushoSupabaseClient
): Promise<Servidor | undefined> {
  const { data } = await cliente.auth.getSession();
  const userId = data.session?.user.id;

  if (!userId) return undefined;

  const bucket = () => cliente.storage.from('epubs');

  return {
    userId,

    async enviar(tabela, linhas) {
      for (let inicio = 0; inicio < linhas.length; inicio += POR_ENVIO) {
        const lote = linhas
          .slice(inicio, inicio + POR_ENVIO)
          .map((linha) => ({ ...linha, user_id: userId }));
        const { error } = await cliente
          .from(tabela as 'books')
          .upsert(lote as never, { onConflict: CONFLITO[tabela] });

        if (error) throw new Error(`Enviar ${tabela}: ${error.message}`);
      }
    },

    async receber<T extends TabelaSinc>(
      tabela: T,
      desde: string | undefined,
      limite: number,
      pulo: number
    ) {
      let consulta = cliente
        .from(tabela as 'books')
        .select('*')
        .order('updated_at');

      for (const coluna of CHAVE[tabela]) {
        consulta = consulta.order(coluna as 'id');
      }

      if (desde) consulta = consulta.gt('updated_at', desde);

      const { data: linhas, error } = await consulta.range(pulo, pulo + limite - 1);

      if (error) throw new Error(`Receber ${tabela}: ${error.message}`);

      return (linhas ?? []) as unknown as Linhas[T][];
    },

    async subir(caminho, dados) {
      const { error } = await bucket().upload(caminho, dados, {
        upsert: true,
        contentType: dados.type || 'application/octet-stream'
      });

      if (error) throw new Error(`Subir ${caminho}: ${error.message}`);
    },

    async baixar(caminho, aoProgredir) {
      if (!aoProgredir) {
        const { data: arquivo, error } = await bucket().download(caminho);

        if (error || !arquivo) throw new Error(`Baixar ${caminho}: ${error?.message}`);

        return arquivo;
      }

      const { data: assinado, error } = await bucket().createSignedUrl(caminho, 600);

      if (error || !assinado) throw new Error(`Baixar ${caminho}: ${error?.message}`);

      const resposta = await fetch(assinado.signedUrl);

      if (!resposta.ok || !resposta.body) {
        throw new Error(`Baixar ${caminho}: HTTP ${resposta.status}`);
      }

      const total = Number(resposta.headers.get('content-length')) || 0;
      const leitor = resposta.body.getReader();
      const partes: Uint8Array[] = [];

      let feito = 0;

      for (;;) {
        const { done, value } = await leitor.read();

        if (done) break;

        partes.push(value);
        feito += value.length;
        aoProgredir(feito, total);
      }

      return new Blob(partes as BlobPart[]);
    },

    async apagar(caminhos) {
      const { error } = await bucket().remove(caminhos);

      if (error) throw new Error(`Apagar arquivos: ${error.message}`);
    }
  };
}
