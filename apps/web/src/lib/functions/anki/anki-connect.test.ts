/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it, vi } from 'vitest';
import { criarAnkiConnect, ErroAnkiConnect } from './anki-connect';

type Pedido = { action: string; version: number; params?: Record<string, unknown> };

/** fetch falso que responde cada ação com a função dada e guarda os pedidos. */
function fetchFalso(respostas: Record<string, (params: any) => unknown>) {
  const pedidos: Pedido[] = [];
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const pedido = JSON.parse(String(init.body)) as Pedido;
    pedidos.push(pedido);
    const responder = respostas[pedido.action];
    const corpo = responder
      ? { result: responder(pedido.params), error: null }
      : { result: null, error: `unsupported action` };
    return new Response(JSON.stringify(corpo));
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, pedidos };
}

describe('criarAnkiConnect', () => {
  it('manda a ação com version 6 para a URL configurada', async () => {
    const { fetch, pedidos } = fetchFalso({ version: () => 6 });
    const anki = criarAnkiConnect({ url: 'http://127.0.0.1:8765', fetch });

    expect(await anki.invocar('version')).toBe(6);
    expect(pedidos).toEqual([{ action: 'version', version: 6 }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://127.0.0.1:8765');
  });

  it('recusa getDeckStats sem chamar a rede (cria deck quando o nome não existe)', async () => {
    const { fetch } = fetchFalso({});
    const anki = criarAnkiConnect({ fetch });

    await expect(anki.invocar('getDeckStats' as never)).rejects.toMatchObject({
      tipo: 'acao-proibida'
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('transforma o campo error do AnkiConnect em ErroAnkiConnect', async () => {
    const fetch = (async () =>
      new Response(
        JSON.stringify({ result: null, error: 'sync: auth not configured' })
      )) as typeof globalThis.fetch;
    const anki = criarAnkiConnect({ fetch });

    const erro = await anki.invocar('sync').catch((e) => e);
    expect(erro).toBeInstanceOf(ErroAnkiConnect);
    expect(erro).toMatchObject({ tipo: 'anki', message: 'sync: auth not configured' });
  });

  it('transforma falha de rede (Anki fechado, CORS, rede local) em erro do tipo rede', async () => {
    const fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof globalThis.fetch;
    const anki = criarAnkiConnect({ fetch });

    await expect(anki.invocar('version')).rejects.toMatchObject({ tipo: 'rede' });
  });

  it('lista só o deck raiz e os subdecks', async () => {
    const { fetch } = fetchFalso({
      deckNamesAndIds: () => ({
        Default: 1,
        日本語: 2,
        '日本語::1. Dokusho': 3,
        '日本語::2. Kaishi 1.5k': 4,
        日本語X: 5
      })
    });
    const anki = criarAnkiConnect({ fetch });

    expect(await anki.listarDecks('日本語')).toEqual([
      { nome: '日本語', id: 2 },
      { nome: '日本語::1. Dokusho', id: 3 },
      { nome: '日本語::2. Kaishi 1.5k', id: 4 }
    ]);
  });

  it('busca Cards do deck em lotes e junta as etiquetas das notas', async () => {
    const ids = Array.from({ length: 5 }, (_, i) => 100 + i);
    const { fetch, pedidos } = fetchFalso({
      findCards: () => ids,
      cardsInfo: ({ cards }: { cards: number[] }) =>
        cards.map((cardId) => ({
          cardId,
          note: cardId - 100 + 1000,
          deckName: '日本語::2. Kaishi 1.5k',
          modelName: 'Kaishi 1.5k',
          interval: cardId === 100 ? 30 : -600,
          queue: cardId === 101 ? -1 : 2,
          type: 2,
          fields: {
            Word: { value: `語${cardId}`, order: 0 },
            'Word Reading': { value: `ご${cardId}`, order: 1 }
          }
        })),
      notesInfo: ({ notes }: { notes: number[] }) =>
        notes.map((noteId) => ({ noteId, tags: noteId === 1001 ? ['leech', 'kaishi'] : [] }))
    });
    const anki = criarAnkiConnect({ fetch, tamanhoDoLote: 2 });

    const cards = await anki.buscarCards('日本語');

    expect(pedidos[0]).toEqual({
      action: 'findCards',
      version: 6,
      params: { query: '"deck:日本語"' }
    });
    expect(pedidos.filter((p) => p.action === 'cardsInfo').map((p) => p.params)).toEqual([
      { cards: [100, 101] },
      { cards: [102, 103] },
      { cards: [104] }
    ]);
    expect(pedidos.some((p) => p.action === 'getDeckStats')).toBe(false);
    expect(cards).toHaveLength(5);
    expect(cards[0]).toEqual({
      cardId: 100,
      noteId: 1000,
      deck: '日本語::2. Kaishi 1.5k',
      modelo: 'Kaishi 1.5k',
      word: '語100',
      wordReading: 'ご100',
      intervalo: 30,
      suspenso: false,
      leech: false,
      etiquetas: [],
      queue: 2,
      tipo: 2
    });
    expect(cards[1]).toMatchObject({ suspenso: true, leech: true, etiquetas: ['leech', 'kaishi'] });
  });

  it('usa o primeiro campo como Word quando o tipo de nota não tem Word', async () => {
    const { fetch } = fetchFalso({
      findCards: () => [1],
      cardsInfo: () => [
        {
          cardId: 1,
          note: 2,
          deckName: '日本語::3. Old',
          modelName: 'Basic',
          interval: 0,
          queue: 0,
          type: 0,
          fields: { Back: { value: 'verso', order: 1 }, Front: { value: '猫', order: 0 } }
        }
      ],
      notesInfo: () => [{ noteId: 2, tags: [] }]
    });
    const anki = criarAnkiConnect({ fetch });

    expect(await anki.buscarCards('日本語')).toMatchObject([{ word: '猫', wordReading: '' }]);
  });
});
