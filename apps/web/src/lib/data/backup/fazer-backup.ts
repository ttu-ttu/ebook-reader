/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter
} from '@zip.js/zip.js';
import { supabase } from '$lib/data/supabase/client';
import { sincronizarAgora } from '$lib/data/supabase/sincronizacao/iniciar';
import {
  arquivosDoBackup,
  CHAVES_DO_BACKUP,
  lerBackup,
  linhasParaRestaurar,
  TABELAS_DO_BACKUP,
  type TabelaDoBackup
} from './backup';

// O backup no app: lê as tabelas do Supabase (com RLS, só as suas) e monta o zip; a restauração
// sobe as linhas com upsert e sincroniza.

const CHAVE_ULTIMO = 'dokusho-ultimo-backup';
const POR_PAGINA = 1000;
const POR_ENVIO = 500;

type Linha = Record<string, unknown>;

export function ultimoBackup() {
  try {
    return Number(localStorage.getItem(CHAVE_ULTIMO)) || undefined;
  } catch {
    return undefined;
  }
}

async function exigirLogin() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  if (!userId) throw new Error('Entre na conta para fazer ou restaurar o backup');
  if (!navigator.onLine) throw new Error('Sem conexão');

  return userId;
}

async function lerTabela(tabela: TabelaDoBackup) {
  const linhas: Linha[] = [];

  for (let pulo = 0; ; pulo += POR_PAGINA) {
    const { data, error } = await supabase
      .from(tabela as 'books')
      .select('*')
      .range(pulo, pulo + POR_PAGINA - 1);

    if (error) throw new Error(`${tabela}: ${error.message}`);

    linhas.push(...((data ?? []) as Linha[]));

    if (!data || data.length < POR_PAGINA) return linhas;
  }
}

/** Monta o zip do backup (o segundo toque entrega o arquivo). */
export async function prepararBackup(aoProgredir?: (texto: string) => void) {
  await exigirLogin();

  const tabelas: Partial<Record<TabelaDoBackup, Linha[]>> = {};

  for (const tabela of TABELAS_DO_BACKUP) {
    aoProgredir?.(`Lendo ${tabela}`);
    tabelas[tabela] = await lerTabela(tabela);
  }

  const agora = new Date().toISOString();
  const zip = new ZipWriter(new BlobWriter('application/zip'));

  for (const [nome, conteudo] of arquivosDoBackup(tabelas, agora)) {
    await zip.add(nome, new TextReader(conteudo));
  }

  return { arquivo: await zip.close(), nome: `dokusho-backup-${agora.slice(0, 10)}.zip` };
}

export function marcarBackupFeito() {
  try {
    localStorage.setItem(CHAVE_ULTIMO, String(Date.now()));
  } catch {
    // Sem localStorage, a data some das configurações.
  }
}

/** Sobe as linhas do backup (mescla pela última escrita) e sincroniza. Devolve quantas subiram. */
export async function restaurarBackup(arquivo: Blob, aoProgredir?: (texto: string) => void) {
  const userId = await exigirLogin();
  const leitor = new ZipReader(new BlobReader(arquivo));
  const arquivos = new Map<string, string>();

  try {
    for (const entrada of await leitor.getEntries()) {
      if (!entrada.directory)
        arquivos.set(entrada.filename, await entrada.getData!(new TextWriter()));
    }
  } finally {
    await leitor.close();
  }

  const { tabelas } = lerBackup(arquivos);
  let total = 0;

  for (const tabela of TABELAS_DO_BACKUP) {
    const linhas = linhasParaRestaurar(tabelas[tabela] ?? [], userId);

    for (let inicio = 0; inicio < linhas.length; inicio += POR_ENVIO) {
      aoProgredir?.(`Restaurando ${tabela} (${inicio + 1} de ${linhas.length})`);

      const { error } = await supabase
        .from(tabela as 'books')
        .upsert(linhas.slice(inicio, inicio + POR_ENVIO) as never, {
          onConflict: CHAVES_DO_BACKUP[tabela]
        });

      if (error) throw new Error(`${tabela}: ${error.message}`);
    }

    total += linhas.length;
  }

  await sincronizarAgora();

  return total;
}
