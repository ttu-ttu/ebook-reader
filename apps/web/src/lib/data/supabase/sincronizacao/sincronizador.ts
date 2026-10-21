/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { IDBPDatabase } from 'idb';
import type BooksDb from '$lib/data/database/books-db/versions/books-db';
import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
import { StorageDataType } from '$lib/data/storage/storage-types';
import type { BancoSinc, LivroSinc } from './banco';
import { deszipLivro, zipLivro } from './livro-zip';
import {
  alcancePelaLeitura,
  alcanceRecebido,
  caminhosDoLivro,
  deIso,
  estatisticaParaLinha,
  hashDoArquivo,
  linhaParaEstatistica,
  linhaParaMarcador,
  linhaParaMeta,
  marcadorParaLinha,
  metaParaLinha,
  paraIso,
  precisaEnviar,
  remotoVence,
  type Aparelho,
  type LinhaEstatistica,
  type LinhaLivro,
  type LinhaMarcador,
  type LinhaMeta,
  type NovaLinhaEstatistica,
  type NovaLinhaLivro,
  type NovaLinhaMarcador,
  type NovaLinhaMeta
} from './regras';

// Sincronização do ttu pelo Supabase (ADR 0014): primeiro recebe o que mudou no servidor desde o
// último cursor, depois envia o que mudou aqui desde o último envio. A última escrita vence pelo
// horário do aparelho (ADR 0002): o gatilho do banco ignora um update mais velho.

export interface Linhas {
  books: LinhaLivro;
  bookmarks: LinhaMarcador;
  reading_stats: LinhaEstatistica;
  reading_goals: LinhaMeta;
}

export interface NovasLinhas {
  books: NovaLinhaLivro;
  bookmarks: NovaLinhaMarcador;
  reading_stats: NovaLinhaEstatistica;
  reading_goals: NovaLinhaMeta;
}

export type TabelaSinc = keyof Linhas;

export interface Servidor {
  userId: string;
  /** Upsert na chave primária da tabela. */
  enviar<T extends TabelaSinc>(tabela: T, linhas: NovasLinhas[T][]): Promise<void>;
  /**
   * Linhas com updated_at > desde (todas, sem desde), em ordem de updated_at e da chave, pulando
   * as primeiras `pulo`.
   */
  receber<T extends TabelaSinc>(
    tabela: T,
    desde: string | undefined,
    limite: number,
    pulo: number
  ): Promise<Linhas[T][]>;
  subir(caminho: string, dados: Blob): Promise<void>;
  baixar(caminho: string, aoProgredir?: (feito: number, total: number) => void): Promise<Blob>;
  apagar(caminhos: string[]): Promise<void>;
}

export interface Avisos {
  livros(): void;
  marcadores(): void;
  metas(): void;
  estatisticas(): void;
}

export interface OpcoesSincronizador {
  ttu: Promise<IDBPDatabase<BooksDb>>;
  sinc: Promise<BancoSinc>;
  /** undefined quando não há sessão: nada é sincronizado. */
  servidor: () => Promise<Servidor | undefined>;
  aparelho: Aparelho;
  avisos: Avisos;
  apagarLivroLocal(dataId: number): Promise<void>;
  limite?: number;
}

export type ResultadoSinc = 'feito' | 'sem-login';

const chave = (tabela: TabelaSinc, ...partes: string[]) => [tabela, ...partes].join('|');

export class Sincronizador {
  private rodando: Promise<ResultadoSinc> | undefined;

  private deNovo = false;

  private readonly limite: number;

  constructor(private readonly opcoes: OpcoesSincronizador) {
    this.limite = opcoes.limite ?? 1000;
  }

  get aparelho() {
    return this.opcoes.aparelho;
  }

  /** Uma rodada por vez; um pedido no meio de uma rodada roda outra logo depois. */
  sincronizar(): Promise<ResultadoSinc> {
    if (this.rodando) {
      this.deNovo = true;
      return this.rodando;
    }

    this.rodando = (async () => {
      let resultado: ResultadoSinc;

      do {
        this.deNovo = false;
        resultado = await this.rodada();
      } while (this.deNovo && resultado === 'feito');

      return resultado;
    })().finally(() => {
      this.rodando = undefined;
    });

    return this.rodando;
  }

  /** Livro recém-importado: guarda o EPUB até subir. Chamar antes de gravar o livro no ttu. */
  async registrarImportado(arquivo: Blob, titulo: string) {
    const sinc = await this.opcoes.sinc;
    const id = await hashDoArquivo(await arquivo.arrayBuffer());
    const mesmoTitulo = await sinc.getFromIndex('livros', 'titulo', titulo);

    if (mesmoTitulo && mesmoTitulo.id !== id && !mesmoTitulo.apagadoEm) {
      // Outro EPUB com o mesmo título substituiu o livro no ttu: o antigo sai do servidor.
      await sinc.put('livros', { ...mesmoTitulo, apagadoEm: Date.now() });
    }

    await sinc.put('livros', {
      id,
      titulo,
      original: arquivo,
      pendente: { original: true, processado: true, capa: true, linha: true },
      modificado: Date.now()
    });

    return id;
  }

  /** Livros apagados neste aparelho (depois de apagados do ttu): somem dos outros e do bucket. */
  async apagarLivros(titulos: string[]) {
    const sinc = await this.opcoes.sinc;

    for (const titulo of titulos) {
      const livro = await sinc.getFromIndex('livros', 'titulo', titulo);

      if (livro) {
        await sinc.put('livros', { ...livro, apagadoEm: Date.now() });
      }
    }
  }

  async idDoLivro(titulo: string) {
    const sinc = await this.opcoes.sinc;

    return (await sinc.getFromIndex('livros', 'titulo', titulo))?.id;
  }

  async tamanhoNaNuvem(titulo: string) {
    const sinc = await this.opcoes.sinc;

    return (await sinc.getFromIndex('livros', 'titulo', titulo))?.tamanho;
  }

  /** Baixa o livro processado de um livro que está só na nuvem (placeholder do ttu). */
  async baixarLivro(dataId: number, aoProgredir?: (feito: number, total: number) => void) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;
    const servidor = await this.opcoes.servidor();
    const livro = await ttu.get('data', dataId);

    if (!livro) throw new Error('Livro não encontrado');
    if (livro.elementHtml) return;
    if (!servidor) throw new Error('Entre na conta para baixar o livro');

    const mapa = await sinc.getFromIndex('livros', 'titulo', livro.title);

    if (!mapa) throw new Error('Livro sem cópia na nuvem');

    const arquivo = await servidor.baixar(
      caminhosDoLivro(servidor.userId, mapa.id).processado,
      aoProgredir
    );
    const processado = await deszipLivro(arquivo);

    await ttu.put('data', {
      ...processado,
      id: dataId,
      title: livro.title,
      coverImage: processado.coverImage || livro.coverImage,
      hasThumb: true,
      lastBookModified: livro.lastBookModified,
      lastBookOpen: livro.lastBookOpen
    });

    this.opcoes.avisos.livros();
  }

  /**
   * Ao abrir um livro: sincroniza (sem esperar mais que `espera` ms) e devolve o marcador de outro
   * aparelho quando ele é mais novo que o daqui, para o leitor perguntar se quer ir para lá.
   */
  async marcadorDeOutroAparelho(dataId: number, espera = 4000) {
    await Promise.race([
      this.sincronizar().catch(() => undefined),
      new Promise((ok) => {
        setTimeout(ok, espera);
      })
    ]);

    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;
    const livro = await ttu.get('data', dataId);
    const mapa = livro && (await sinc.getFromIndex('livros', 'titulo', livro.title));

    if (!mapa) return undefined;

    const linha = await sinc.get('marcadoresRemotos', mapa.id);
    const local = await ttu.get('bookmark', dataId);

    if (
      linha &&
      linha.device_id !== this.opcoes.aparelho.id &&
      remotoVence(local?.lastBookmarkModified, linha.modified_at)
    ) {
      return linha;
    }

    if (linha) await sinc.delete('marcadoresRemotos', mapa.id);

    return undefined;
  }

  async aplicarMarcadorRemoto(dataId: number, linha: LinhaMarcador) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;

    await ttu.put('bookmark', linhaParaMarcador(linha, dataId));
    await sinc.put('enviados', deIso(linha.modified_at), chave('bookmarks', linha.book_id));
    await sinc.delete('marcadoresRemotos', linha.book_id);
    this.opcoes.avisos.marcadores();
  }

  async dispensarMarcadorRemoto(linha: LinhaMarcador) {
    const sinc = await this.opcoes.sinc;

    await sinc.delete('marcadoresRemotos', linha.book_id);
  }

  /** Estatísticas dos outros aparelhos num intervalo de datas (inclusive). */
  async estatisticasDeOutrosAparelhos(inicio = '', fim = '￿') {
    const sinc = await this.opcoes.sinc;

    return sinc.getAllFromIndex('estatisticasOutras', 'date_key', IDBKeyRange.bound(inicio, fim));
  }

  private async rodada(): Promise<ResultadoSinc> {
    const servidor = await this.opcoes.servidor();

    if (!servidor) return 'sem-login';

    await this.receber(servidor, 'books', (linhas) => this.receberLivros(servidor, linhas));
    await this.receber(servidor, 'bookmarks', (linhas) => this.receberMarcadores(linhas));
    await this.receber(servidor, 'reading_stats', (linhas) => this.receberEstatisticas(linhas));
    await this.receber(servidor, 'reading_goals', (linhas) => this.receberMetas(linhas));

    await this.registrarLivrosLocais();
    await this.enviarApagamentos(servidor);
    await this.enviarLivros(servidor);
    await this.enviarMarcadores(servidor);
    await this.enviarEstatisticas(servidor);
    await this.enviarMetas(servidor);

    return 'feito';
  }

  private async receber<T extends TabelaSinc>(
    servidor: Servidor,
    tabela: T,
    aplicar: (linhas: Linhas[T][]) => Promise<void>
  ) {
    const sinc = await this.opcoes.sinc;

    // Linhas gravadas juntas têm o mesmo updated_at: as páginas andam por posição, e o cursor só
    // avança no fim, para o maior updated_at recebido.
    const desde = await sinc.get('cursores', tabela);

    let pulo = 0;
    let ultimo: string | undefined;

    for (;;) {
      const linhas = await servidor.receber(tabela, desde, this.limite, pulo);

      if (linhas.length) {
        await aplicar(linhas);
        ultimo = linhas[linhas.length - 1].updated_at;
      }

      pulo += linhas.length;

      if (linhas.length < this.limite) break;
    }

    if (ultimo) await sinc.put('cursores', ultimo, tabela);
  }

  private async receberLivros(servidor: Servidor, linhas: LinhaLivro[]) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;

    let mudou = false;

    for (const linha of linhas) {
      const mapa = await sinc.get('livros', linha.id);

      if (linha.deleted_at) {
        // Vale se for mais nova que a importação daqui (reimportar depois de apagar devolve o livro).
        if (mapa && !mapa.apagadoEm && deIso(linha.modified_at) >= mapa.modificado) {
          const local = await ttu.getFromIndex('data', 'title', mapa.titulo);

          if (local) await this.opcoes.apagarLivroLocal(local.id);

          await sinc.delete('livros', linha.id);
          await sinc.delete('marcadoresRemotos', linha.id);
          await sinc.delete('alcances', linha.id);
          mudou = true;
        }
        continue;
      }

      if (mapa) {
        if (mapa.apagadoEm && mapa.apagadoEm < deIso(linha.modified_at)) {
          // Importado de novo em outro aparelho depois de apagado aqui.
          const { apagadoEm: _, ...semApagado } = mapa;

          await sinc.put('livros', {
            ...semApagado,
            pendente: {},
            tamanho: linha.processed_size ?? undefined
          });
        } else if (linha.processed_size && mapa.tamanho !== linha.processed_size) {
          await sinc.put('livros', { ...mapa, tamanho: linha.processed_size });
        }
        continue;
      }

      const outroMesmoTitulo = await sinc.getFromIndex('livros', 'titulo', linha.title);

      if (outroMesmoTitulo) {
        // O ttu não guarda dois livros com o mesmo título (ADR 0014): fica o daqui.
        continue;
      }

      const novo: LivroSinc = {
        id: linha.id,
        titulo: linha.title,
        pendente: {},
        temOriginal: !!linha.original_path,
        modificado: deIso(linha.modified_at),
        tamanho: linha.processed_size ?? undefined
      };

      if (!(await ttu.getFromIndex('data', 'title', linha.title))) {
        const capa = linha.cover_path
          ? await servidor.baixar(linha.cover_path).catch(() => undefined)
          : undefined;
        const placeholder: Omit<BooksDbBookData, 'id'> = {
          title: linha.title,
          styleSheet: '',
          elementHtml: '',
          blobs: {},
          coverImage: capa || '',
          hasThumb: !!capa,
          characters: linha.characters,
          sections: [],
          lastBookModified: deIso(linha.modified_at),
          lastBookOpen: 0
        };

        await ttu.add('data', placeholder as BooksDbBookData);
      }

      await sinc.put('livros', novo);
      mudou = true;
    }

    if (mudou) this.opcoes.avisos.livros();
  }

  private async receberMarcadores(linhas: LinhaMarcador[]) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;

    let mudou = false;

    for (const linha of linhas) {
      if (linha.deleted_at) {
        await sinc.delete('marcadoresRemotos', linha.book_id);
        continue;
      }

      const mapa = await sinc.get('livros', linha.book_id);
      const livro = mapa && (await ttu.getFromIndex('data', 'title', mapa.titulo));

      if (!livro) continue;

      const local = await ttu.get('bookmark', livro.id);
      const alcance = await sinc.get('alcances', linha.book_id);

      await sinc.put(
        'alcances',
        alcanceRecebido(alcance, local?.lastBookmarkModified, linha),
        linha.book_id
      );

      if (!remotoVence(local?.lastBookmarkModified, linha.modified_at)) continue;

      if (!local || linha.device_id === this.opcoes.aparelho.id) {
        await ttu.put('bookmark', linhaParaMarcador(linha, livro.id));
        await sinc.put('enviados', deIso(linha.modified_at), chave('bookmarks', linha.book_id));
        mudou = true;
      } else {
        // Não pula sozinho: o leitor pergunta ao abrir o livro.
        await sinc.put('marcadoresRemotos', linha, linha.book_id);
      }
    }

    if (mudou) this.opcoes.avisos.marcadores();
  }

  private async receberEstatisticas(linhas: LinhaEstatistica[]) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;

    let mudou = false;

    for (const linha of linhas) {
      if (linha.device_id !== this.opcoes.aparelho.id) {
        if (linha.deleted_at) {
          await sinc.delete('estatisticasOutras', [linha.book_id, linha.date_key, linha.device_id]);
        } else {
          await sinc.put('estatisticasOutras', linha);
        }
        mudou = true;
        continue;
      }

      // Linha deste aparelho que falta aqui porque o banco foi apagado (o iOS apaga): volta para
      // o ttu. Se este banco já a enviou, a falta é uma exclusão daqui, que o envio leva.
      const mapa = await sinc.get('livros', linha.book_id);
      const chaveEstatistica = chave('reading_stats', linha.book_id, linha.date_key);

      if (linha.deleted_at || !mapa) continue;
      if (await ttu.get('statistic', [mapa.titulo, linha.date_key])) continue;
      if ((await sinc.get('enviados', chaveEstatistica)) !== undefined) continue;

      await ttu.put('statistic', linhaParaEstatistica(linha, mapa.titulo));
      await ttu.put('lastModified', {
        title: mapa.titulo,
        dataType: StorageDataType.STATISTICS,
        lastModifiedValue: deIso(linha.modified_at)
      });
      await sinc.put('enviados', deIso(linha.modified_at), chaveEstatistica);
      mudou = true;
    }

    if (mudou) this.opcoes.avisos.estatisticas();
  }

  private async receberMetas(linhas: LinhaMeta[]) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;

    let mudou = false;

    for (const linha of linhas) {
      const local = await ttu.get('readingGoal', linha.goal_start_date);
      const chaveMeta = chave('reading_goals', linha.goal_start_date);

      const enviado = await sinc.get('enviados', chaveMeta);

      if (!remotoVence(local?.lastGoalModified, linha.modified_at)) continue;

      // Meta apagada aqui e ainda não avisada ao servidor: a linha não é mais nova que o envio.
      if (!local && enviado !== undefined && deIso(linha.modified_at) <= enviado) continue;

      if (linha.deleted_at) {
        if (local) {
          await ttu.delete('readingGoal', linha.goal_start_date);
          mudou = true;
        }
        await sinc.delete('enviados', chaveMeta);
        continue;
      }

      await ttu.put('readingGoal', linhaParaMeta(linha));
      await sinc.put('enviados', deIso(linha.modified_at), chaveMeta);
      mudou = true;
    }

    if (mudou) this.opcoes.avisos.metas();
  }

  /** Livros do ttu sem hash (importados antes do V1.1, ou TXT/HTMLZ): hash do texto processado. */
  private async registrarLivrosLocais() {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;

    for (const livro of await ttu.getAll('data')) {
      if (!livro.elementHtml || (await sinc.getFromIndex('livros', 'titulo', livro.title))) {
        continue;
      }

      const texto = new TextEncoder().encode(livro.elementHtml);

      await sinc.put('livros', {
        id: await hashDoArquivo(texto.buffer as ArrayBuffer),
        titulo: livro.title,
        pendente: { processado: true, capa: true, linha: true },
        modificado: livro.lastBookModified || Date.now()
      });
    }
  }

  private async enviarApagamentos(servidor: Servidor) {
    const sinc = await this.opcoes.sinc;

    for (const livro of await sinc.getAll('livros')) {
      if (!livro.apagadoEm) continue;

      const quando = paraIso(livro.apagadoEm);
      const caminhos = caminhosDoLivro(servidor.userId, livro.id);

      await servidor.enviar('books', [
        { id: livro.id, title: livro.titulo, modified_at: quando, deleted_at: quando }
      ]);
      await servidor.enviar('bookmarks', [
        { book_id: livro.id, modified_at: quando, deleted_at: quando }
      ]);
      await servidor.apagar([caminhos.processado, caminhos.original, caminhos.capa]);

      // Se o mesmo título foi importado de novo, o registro novo (outro hash) fica.
      await sinc.delete('livros', livro.id);
      await sinc.delete('marcadoresRemotos', livro.id);
      await sinc.delete('alcances', livro.id);
      await sinc.delete('enviados', chave('bookmarks', livro.id));
    }
  }

  private async enviarLivros(servidor: Servidor) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;

    for (const mapa of await sinc.getAll('livros')) {
      if (mapa.apagadoEm || !Object.keys(mapa.pendente).length) continue;

      const livro = await ttu.getFromIndex('data', 'title', mapa.titulo);

      if (!livro?.elementHtml) continue;

      const caminhos = caminhosDoLivro(servidor.userId, mapa.id);
      const temCapa = livro.coverImage instanceof Blob;
      const atualizado: LivroSinc = { ...mapa };

      if (mapa.pendente.processado || !mapa.tamanho) {
        const zip = await zipLivro(livro);

        await servidor.subir(caminhos.processado, zip);
        atualizado.tamanho = zip.size;
      }

      if (mapa.pendente.capa && livro.coverImage instanceof Blob) {
        await servidor.subir(caminhos.capa, livro.coverImage);
      }

      if (mapa.pendente.original && mapa.original) {
        await servidor.subir(caminhos.original, mapa.original);
        atualizado.temOriginal = true;
      }

      await servidor.enviar('books', [
        {
          id: mapa.id,
          title: mapa.titulo,
          characters: livro.characters || 0,
          cover_path: temCapa ? caminhos.capa : null,
          processed_path: caminhos.processado,
          original_path: atualizado.temOriginal ? caminhos.original : null,
          processed_size: atualizado.tamanho ?? null,
          modified_at: paraIso(mapa.modificado),
          deleted_at: null
        }
      ]);

      delete atualizado.original;
      atualizado.pendente = {};
      await sinc.put('livros', atualizado);
    }
  }

  private async enviarMarcadores(servidor: Servidor) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;
    const linhas: NovaLinhaMarcador[] = [];

    for (const marcador of await ttu.getAll('bookmark')) {
      const livro = await ttu.get('data', marcador.dataId);
      const mapa = livro && (await sinc.getFromIndex('livros', 'titulo', livro.title));

      if (!mapa || mapa.apagadoEm) continue;

      const chaveMarcador = chave('bookmarks', mapa.id);
      const alcance = await sinc.get('alcances', mapa.id);
      const valor = alcancePelaLeitura(alcance?.valor, marcador.exploredCharCount);

      if (!alcance || valor !== alcance.valor) {
        await sinc.put('alcances', { ...alcance, valor }, mapa.id);
      }

      if (
        !precisaEnviar(marcador.lastBookmarkModified, await sinc.get('enviados', chaveMarcador))
      ) {
        continue;
      }

      linhas.push(marcadorParaLinha(mapa.id, marcador, valor, this.opcoes.aparelho));
    }

    if (!linhas.length) return;

    await servidor.enviar('bookmarks', linhas);

    for (const linha of linhas) {
      await sinc.put('enviados', deIso(linha.modified_at), chave('bookmarks', linha.book_id));
    }
  }

  private async enviarEstatisticas(servidor: Servidor) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;
    const linhas: NovaLinhaEstatistica[] = [];
    const presentes = new Set<string>();
    const livrosAqui = new Set<string>();

    for (const mapa of await sinc.getAll('livros')) {
      const livro = await ttu.getFromIndex('data', 'title', mapa.titulo);

      if (livro?.elementHtml && !mapa.apagadoEm) livrosAqui.add(mapa.id);
    }

    for (const estatistica of await ttu.getAll('statistic')) {
      const mapa = await sinc.getFromIndex('livros', 'titulo', estatistica.title);

      if (!mapa || mapa.apagadoEm) continue;

      const chaveEstatistica = chave('reading_stats', mapa.id, estatistica.dateKey);

      presentes.add(chaveEstatistica);

      if (
        precisaEnviar(
          estatistica.lastStatisticModified,
          await sinc.get('enviados', chaveEstatistica)
        )
      ) {
        linhas.push(estatisticaParaLinha(mapa.id, estatistica, this.opcoes.aparelho));
      }
    }

    // Estatística apagada aqui (tela de estatísticas do ttu) de um livro que continua aqui.
    const agora = paraIso(Date.now());

    for (const chaveEnviada of await sinc.getAllKeys('enviados')) {
      const [tabela, livroId, dia] = chaveEnviada.split('|');

      if (tabela !== 'reading_stats' || presentes.has(chaveEnviada) || !livrosAqui.has(livroId)) {
        continue;
      }

      linhas.push({
        book_id: livroId,
        date_key: dia,
        device_id: this.opcoes.aparelho.id,
        modified_at: agora,
        deleted_at: agora
      });
    }

    if (!linhas.length) return;

    await servidor.enviar('reading_stats', linhas);

    for (const linha of linhas) {
      const chaveEstatistica = chave('reading_stats', linha.book_id, linha.date_key);

      if (linha.deleted_at) {
        await sinc.delete('enviados', chaveEstatistica);
      } else {
        await sinc.put('enviados', deIso(linha.modified_at), chaveEstatistica);
      }
    }
  }

  private async enviarMetas(servidor: Servidor) {
    const ttu = await this.opcoes.ttu;
    const sinc = await this.opcoes.sinc;
    const linhas: NovaLinhaMeta[] = [];
    const presentes = new Set<string>();

    for (const meta of await ttu.getAll('readingGoal')) {
      const chaveMeta = chave('reading_goals', meta.goalStartDate);

      presentes.add(chaveMeta);

      if (precisaEnviar(meta.lastGoalModified, await sinc.get('enviados', chaveMeta))) {
        linhas.push(metaParaLinha(meta));
      }
    }

    const agora = paraIso(Date.now());

    for (const chaveEnviada of await sinc.getAllKeys('enviados')) {
      const [tabela, inicio] = chaveEnviada.split('|');

      if (tabela === 'reading_goals' && !presentes.has(chaveEnviada)) {
        linhas.push({ goal_start_date: inicio, modified_at: agora, deleted_at: agora });
      }
    }

    if (!linhas.length) return;

    await servidor.enviar('reading_goals', linhas);

    for (const linha of linhas) {
      const chaveMeta = chave('reading_goals', linha.goal_start_date);

      if (linha.deleted_at) {
        await sinc.delete('enviados', chaveMeta);
      } else {
        await sinc.put('enviados', deIso(linha.modified_at), chaveMeta);
      }
    }
  }
}
