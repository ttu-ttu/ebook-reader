/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Cliente do AnkiConnect (add-on do Anki do PC, em localhost:8765). Só passam as ações da lista:
 * nada que escreva na coleção e nunca `getDeckStats`, que cria o deck quando o nome não existe.
 * O Anki só aceita a origem da página se ela estiver no `webCorsOriginList` (docs/ANKI-CONNECT.md).
 */

export const ACOES_PERMITIDAS = [
  'version',
  'sync',
  'deckNamesAndIds',
  'findCards',
  'cardsInfo',
  'notesInfo'
] as const;

export type AcaoPermitida = (typeof ACOES_PERMITIDAS)[number];

export type TipoErroAnkiConnect = 'acao-proibida' | 'rede' | 'tempo' | 'anki';

export class ErroAnkiConnect extends Error {
  constructor(
    message: string,
    readonly tipo: TipoErroAnkiConnect
  ) {
    super(message);
    this.name = 'ErroAnkiConnect';
  }
}

export interface DeckAnki {
  nome: string;
  id: number;
}

export interface CardAnki {
  cardId: number;
  noteId: number;
  deck: string;
  modelo: string;
  word: string;
  wordReading: string;
  /** Dias; negativo é segundos (Card em aprendizado). */
  intervalo: number;
  suspenso: boolean;
  leech: boolean;
  etiquetas: string[];
  /** -1 suspenso, -2/-3 enterrado, 0 novo, 1/3 aprendendo, 2 revisão. */
  queue: number;
  /** 0 novo, 1 aprendendo, 2 revisão, 3 reaprendendo. */
  tipo: number;
}

interface CardInfo {
  cardId: number;
  note: number;
  deckName: string;
  modelName: string;
  interval: number;
  queue: number;
  type: number;
  fields: Record<string, { value: string; order: number }>;
}

interface NoteInfo {
  noteId: number;
  tags: string[];
}

export interface OpcoesAnkiConnect {
  url?: string;
  fetch?: typeof globalThis.fetch;
  /** Ids por chamada de cardsInfo/notesInfo. */
  tamanhoDoLote?: number;
  /** Tempo máximo de uma chamada comum, em ms. */
  tempoLimite?: number;
  /** Tempo máximo do `sync` com o AnkiWeb, em ms. */
  tempoLimiteSync?: number;
  /** Pausa entre as tentativas depois do sync (trocada nos testes). */
  esperar?: (ms: number) => Promise<void>;
}

export const URL_ANKI_CONNECT = 'http://127.0.0.1:8765';

const INTERVALO_DA_ESPERA = 500;

export function criarAnkiConnect({
  url = URL_ANKI_CONNECT,
  fetch = globalThis.fetch.bind(globalThis),
  tamanhoDoLote = 200,
  tempoLimite = 30_000,
  tempoLimiteSync = 300_000,
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}: OpcoesAnkiConnect = {}) {
  async function invocar<T = unknown>(
    acao: AcaoPermitida,
    params?: Record<string, unknown>,
    limite = tempoLimite
  ): Promise<T> {
    if (!(ACOES_PERMITIDAS as readonly string[]).includes(acao)) {
      throw new ErroAnkiConnect(`Ação do AnkiConnect fora da lista: ${acao}`, 'acao-proibida');
    }

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(
          params ? { action: acao, version: 6, params } : { action: acao, version: 6 }
        ),
        signal: AbortSignal.timeout(limite)
      });
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'TimeoutError') {
        throw new ErroAnkiConnect(`${acao} passou de ${Math.round(limite / 1000)} s`, 'tempo');
      }
      throw new ErroAnkiConnect(
        'Sem resposta do AnkiConnect: Anki fechado, add-on ausente, origem fora do ' +
          'webCorsOriginList ou permissão de rede local negada no Chrome',
        'rede'
      );
    }

    const corpo = (await resposta.json()) as { result: T; error: string | null };
    if (corpo.error) throw new ErroAnkiConnect(corpo.error, 'anki');
    return corpo.result;
  }

  async function emLotes<T>(ids: number[], buscar: (lote: number[]) => Promise<T[]>) {
    const saida: T[] = [];
    for (let i = 0; i < ids.length; i += tamanhoDoLote) {
      saida.push(...(await buscar(ids.slice(i, i + tamanhoDoLote))));
    }
    return saida;
  }

  /**
   * Sincroniza o Anki do PC com o AnkiWeb e espera a coleção ficar livre. O `sync` volta quando a
   * coleção terminou, mas o Anki ainda dispara a sincronização da interface, e até ela acabar toda
   * leitura falha com "Collection lifecycle operation is active".
   */
  async function sincronizar() {
    await invocar<null>('sync', undefined, tempoLimiteSync);
    for (let esperado = 0; ; esperado += INTERVALO_DA_ESPERA) {
      try {
        await invocar('deckNamesAndIds');
        return;
      } catch (erro) {
        const ocupada = erro instanceof ErroAnkiConnect && /lifecycle/i.test(erro.message);
        if (!ocupada) throw erro;
        if (esperado >= tempoLimiteSync) {
          throw new ErroAnkiConnect(
            `A coleção continuou ocupada ${Math.round(tempoLimiteSync / 1000)} s depois do sync`,
            'tempo'
          );
        }
        await esperar(INTERVALO_DA_ESPERA);
      }
    }
  }

  async function listarDecks(raiz: string): Promise<DeckAnki[]> {
    const decks = await invocar<Record<string, number>>('deckNamesAndIds');
    return Object.entries(decks)
      .filter(([nome]) => nome === raiz || nome.startsWith(`${raiz}::`))
      .map(([nome, id]) => ({ nome, id }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  /** Todos os Cards do deck raiz e dos subdecks, com as etiquetas da nota. */
  async function buscarCards(raiz: string): Promise<CardAnki[]> {
    const ids = await invocar<number[]>('findCards', { query: `"deck:${raiz}"` });
    const infos = await emLotes(ids, (cards) => invocar<CardInfo[]>('cardsInfo', { cards }));

    const idsNotas = [...new Set(infos.map((info) => info.note))];
    const notas = await emLotes(idsNotas, (notes) => invocar<NoteInfo[]>('notesInfo', { notes }));
    const etiquetasPorNota = new Map(notas.map((nota) => [nota.noteId, nota.tags]));

    return infos.map((info) => {
      const etiquetas = etiquetasPorNota.get(info.note) ?? [];
      const primeiroCampo = Object.values(info.fields).sort((a, b) => a.order - b.order)[0];
      return {
        cardId: info.cardId,
        noteId: info.note,
        deck: info.deckName,
        modelo: info.modelName,
        word: info.fields.Word?.value ?? primeiroCampo?.value ?? '',
        wordReading: info.fields['Word Reading']?.value ?? '',
        intervalo: info.interval,
        suspenso: info.queue === -1,
        leech: etiquetas.some((etiqueta) => etiqueta.toLowerCase() === 'leech'),
        etiquetas,
        queue: info.queue,
        tipo: info.type
      };
    });
  }

  return { invocar, sincronizar, listarDecks, buscarCards };
}
