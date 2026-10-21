/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { supabase } from '$lib/data/supabase/client';
import { sincronizador, sincronizarEmBreve } from '$lib/data/supabase/sincronizacao/iniciar';
import type { LinhaCarta, LinhaLote } from '$lib/data/supabase/sincronizacao/regras';
import { gerarApkg, type MidiaApkg, type NotaApkg } from '$lib/functions/anki/apkg';
import { carregarSqlJs } from '$lib/functions/anki/sql-js';
import { geracao } from './fila';
import { audiosParaApagar, cartasExportaveis, notaDaCarta } from './exportar';

// Lotes no app (V1.6): montar o .apkg com os áudios do bucket, gravar o Lote quando o arquivo é
// entregue, baixar um Lote de novo, reexportar uma carta e apagar o áudio dos Lotes antigos.

export interface LotePronto {
  lote: LinhaLote;
  cartas: LinhaCarta[];
  arquivo: Blob;
  nome: string;
  /** Áudios que não estavam no bucket (a nota vai sem eles). */
  semAudio: number;
}

async function baixarAudio(caminho: string) {
  const { data, error } = await supabase.storage.from('audio').download(caminho);

  if (error || !data) throw new Error(error?.message || `Sem ${caminho}`);

  return data;
}

async function montar(
  cartas: LinhaCarta[],
  lote: LinhaLote,
  aoProgredir?: (texto: string) => void
) {
  const titulos = await sincronizador().titulosDosLivros();
  const notas: NotaApkg[] = [];
  const midias = new Map<string, MidiaApkg>();
  let semAudio = 0;

  for (const [i, carta] of cartas.entries()) {
    aoProgredir?.(`Baixando os áudios (${i + 1} de ${cartas.length})`);

    const { nota, midias: daCarta } = notaDaCarta(
      carta,
      carta.book_id ? titulos.get(carta.book_id) : undefined
    );

    for (const { nome, caminho } of daCarta) {
      if (midias.has(nome)) continue;

      try {
        midias.set(nome, { nome, dados: await baixarAudio(caminho) });
      } catch {
        // Áudio que já saiu do bucket: a nota vai sem ele.
        semAudio += 1;

        for (const campo of ['Word Audio', 'Sentence Audio'] as const) {
          if (nota.campos[campo] === `[sound:${nome}]`) nota.campos[campo] = '';
        }
      }
    }

    notas.push(nota);
  }

  aoProgredir?.('Montando o .apkg');

  const arquivo = await gerarApkg(await carregarSqlJs(), { notas, midias: [...midias.values()] });
  const data = lote.exported_at.slice(0, 10);

  return { lote, cartas, arquivo, nome: `dokusho-${data}-${cartas.length}.apkg`, semAudio };
}

/** Monta o Lote novo com as cartas geradas e ainda não exportadas (e as com erro, se pedir). */
export async function prepararLote(incluirErro: boolean, aoProgredir?: (texto: string) => void) {
  const cartas = cartasExportaveis(await sincronizador().listar('cartas'), incluirErro);

  if (!cartas.length) throw new Error('Nenhuma carta gerada para exportar');

  const agora = new Date().toISOString();
  const { id, nome } = sincronizador().aparelho;
  const lote: LinhaLote = {
    id: crypto.randomUUID(),
    user_id: '',
    exported_at: agora,
    device_id: id,
    device_name: nome,
    confirmed_in_anki_at: null,
    audio_deleted_at: null,
    modified_at: agora,
    updated_at: agora,
    deleted_at: null
  };

  return montar(cartas, lote, aoProgredir);
}

/** Depois de entregue o arquivo: grava o Lote e marca as cartas como exportadas. */
export async function confirmarLote({ lote, cartas }: LotePronto) {
  const agora = new Date().toISOString();

  await sincronizador().salvar('lotes', lote);

  for (const carta of cartas) {
    await sincronizador().salvar('cartas', {
      ...carta,
      state: 'exportada',
      lote_id: lote.id,
      modified_at: agora
    });
  }

  sincronizarEmBreve();
}

export async function cartasDoLote(lote: LinhaLote) {
  return (await sincronizador().listar('cartas')).filter((carta) => carta.lote_id === lote.id);
}

/** "Baixar este Lote de novo": o mesmo Lote, com as mesmas cartas. */
export async function prepararLoteDeNovo(lote: LinhaLote, aoProgredir?: (texto: string) => void) {
  return montar(await cartasDoLote(lote), lote, aoProgredir);
}

/**
 * "Reexportar (sobrescreve o Card no Anki)": a carta volta para a fila e entra no próximo Lote.
 * Se o áudio já saiu do bucket, gera de novo.
 */
export async function reexportarCarta(carta: LinhaCarta) {
  const lote = carta.lote_id ? await sincronizador().ler('lotes', carta.lote_id) : undefined;

  if (lote?.audio_deleted_at) {
    await geracao.refazerAudio(carta.id, { lote_id: null });
    return;
  }

  await sincronizador().salvar('cartas', {
    ...carta,
    state: 'gerada',
    lote_id: null,
    modified_at: new Date().toISOString()
  });
  sincronizarEmBreve();
}

/** Áudio sai do bucket 30 dias depois do Lote baixado (ESCOPO "Áudio"). */
export async function limparAudiosAntigos() {
  const { data: sessao } = await supabase.auth.getSession();

  if (!sessao.session || !navigator.onLine) return;

  const lotes = await sincronizador().listar('lotes');
  const cartas = await sincronizador().listar('cartas');

  for (const { lote, caminhos } of audiosParaApagar(lotes, cartas, Date.now())) {
    if (caminhos.length) {
      const { error } = await supabase.storage.from('audio').remove(caminhos);

      if (error) return;
    }

    const agora = new Date().toISOString();

    await sincronizador().salvar('lotes', { ...lote, audio_deleted_at: agora, modified_at: agora });
  }

  sincronizarEmBreve();
}
